"use client";

/**
 * /overview — the camera-driven "session dashboard".
 *
 * Flow:
 *  1. The eMeet camera runs in the background (no visible frame). `useFaceTracker`
 *     watches for a face with the native FaceDetector.
 *  2. On detection we greet the user (on-screen + TTS) and silently kick off a
 *     background skin analysis (capture → upload → analyze → Socket.io result),
 *     which fills the Cosmetics tile.
 *  3. The user then speaks an intent ("I have a dinner in Baguio tonight"). The
 *     global voice mic routes it through ChatWonder, whose tools (garments,
 *     skin, location, weather) stream back and populate the remaining tiles.
 *  4. Until each tool's data arrives, its tile shows a skeleton.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ScanFace, Loader2, CameraOff } from "lucide-react";
import "../../styles/glow.css";

import { ROUTES } from "@/navigation";
import WeatherWidget from "@/components/WeatherWidget";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useWeather } from "@/modules/shared/hooks/useWeather";
import { ChatWonderChat } from "@/modules/shared/ai/ChatWonderChat";
import type { ChatWonderCompletePayload } from "@/modules/shared/ai/useChatWonderStream";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { mapService } from "@/modules/map/services/map.service";
import { extractLocationFromTranscript } from "@/modules/map/utils/chatWonderMapUtils";
import { useMapStore } from "@/modules/map/store/useMapStore";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import { listenForSkinAnalysis } from "@/modules/shared/api/skinAnalysisSocket";

import {
  OverviewGrid,
  CameraDisclaimer,
  useFaceTracker,
  useOverviewStore,
  adaptGarmentData,
  adaptMapsData,
  adaptOutlineToTiles,
  OVERVIEW_PROMPT_KEY,
} from "@/modules/overview";
import { outlineService } from "@/modules/shared/api/outline.service";

// The voice pipeline emits this extended action (not part of the base union)
// when a garment recommendation resolves; narrow against it safely.
type GarmentRecommendationAction = {
  type: "GARMENT_RECOMMENDATION";
  response?: { garment_data?: unknown; maps_data?: unknown[] };
};
type OverviewVoiceAction = ChatWonderAction | GarmentRecommendationAction;

type OverviewWeatherContext = {
  date: string;
  description: string;
  estimated: boolean;
  is_cold: boolean;
  is_hot: boolean;
  is_rainy: boolean;
  temperature_c: number;
  lat?: number;
  lon?: number;
  location?: string;
};

function weatherToChatContext(
  raw: Record<string, unknown>,
  fallback: { lat?: number; lon?: number; location?: string } = {},
): OverviewWeatherContext | null {
  const tempRaw = raw.temperature ?? raw.temp;
  const temperature =
    typeof tempRaw === "number"
      ? tempRaw
      : typeof tempRaw === "string" && Number.isFinite(Number(tempRaw))
        ? Number(tempRaw)
        : null;
  if (temperature === null) return null;

  const condition = String(raw.condition ?? "").toLowerCase();
  const precipitation = Number(raw.precipitationProb ?? raw.precipitation ?? 0);

  return {
    date: new Date().toISOString().split("T")[0],
    description: condition,
    estimated: false,
    is_cold: temperature < 20,
    is_hot: temperature >= 30,
    is_rainy: precipitation >= 50 || condition.includes("rain"),
    temperature_c: temperature,
    ...fallback,
  };
}

async function fetchDestinationWeather(
  lat: number,
  lng: number,
  location: string,
): Promise<OverviewWeatherContext | null> {
  const res = await fetch(`/api/mirror/weather?lat=${lat}&lng=${lng}`);
  if (!res.ok) return null;
  const json = await res.json();
  const data = (json.data ?? json) as Record<string, unknown>;
  return weatherToChatContext(data, { lat, lon: lng, location });
}

async function requestGarmentsWithFreshSession(
  input: string,
  weather?: OverviewWeatherContext | null,
) {
  try {
    return await chatWonderService.message({
      input,
      ...(weather ? { weather } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("HTTP 409")) {
      await chatWonderService.restart();
      return chatWonderService.message({
        input,
        ...(weather ? { weather } : {}),
      });
    }
    throw err;
  }
}

export default function OverviewPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { weather } = useWeather();

  // ── store actions (stable refs) ──
  const setFaceDetected = useOverviewStore((s) => s.setFaceDetected);
  const setGreeting = useOverviewStore((s) => s.setGreeting);
  const startCosmetics = useOverviewStore((s) => s.startCosmetics);
  const setCosmetics = useOverviewStore((s) => s.setCosmetics);
  const failCosmetics = useOverviewStore((s) => s.failCosmetics);
  const startGarments = useOverviewStore((s) => s.startGarments);
  const setGarments = useOverviewStore((s) => s.setGarments);
  const startOutfits = useOverviewStore((s) => s.startOutfits);
  const setOutfits = useOverviewStore((s) => s.setOutfits);
  const startMap = useOverviewStore((s) => s.startMap);
  const setMap = useOverviewStore((s) => s.setMap);
  const emptyMap = useOverviewStore((s) => s.emptyMap);
  const failMap = useOverviewStore((s) => s.failMap);
  const reset = useOverviewStore((s) => s.reset);

  const greeting = useOverviewStore((s) => s.greeting);

  // True when we arrived here from /ai-assistant carrying a spoken prompt —
  // suppresses the face-detection greeting (the assistant already greeted).
  const cameFromAssistantRef = useRef(false);
  const handoffFiredRef = useRef(false);

  // ── reset the grid whenever a fresh session lands here ──
  useEffect(() => {
    reset();
    return () => reset();
  }, [reset]);

  // ── hybrid hydration: reflect the persisted Outline on arrival ──
  // Overview is a downstream dashboard, so on mount we fill the tiles from the
  // user's saved Outline. Live ChatWonder updates overwrite these afterward. The
  // Map tile fills via the map-store effect once loadOutlineStops geocodes the
  // events' destinations.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const outline = await outlineService.getActive();
        if (cancelled || !outline) return;
        const { garments, outfits, cosmetics } = adaptOutlineToTiles(outline);
        if (garments.length) setGarments(garments);
        if (outfits.length) setOutfits(outfits);
        if (cosmetics) setCosmetics(cosmetics);
        void useMapStore.getState().loadOutlineStops();
      } catch {
        /* hydration is best-effort; live updates still populate the tiles */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setGarments, setOutfits, setCosmetics]);

  // ── background skin analysis ──
  const runSkinAnalysis = useCallback(
    async (frameDataUrl: string) => {
      startCosmetics();
      let unsubscribe = () => {};
      try {
        // Subscribe BEFORE POSTing so the pushed result can't race ahead of us.
        unsubscribe = await listenForSkinAnalysis({
          onComplete: (raw) => {
            const r = raw as { data?: SkinAnalysis } & SkinAnalysis;
            const analysis = (r?.skinType ? r : r?.data) as SkinAnalysis;
            if (analysis) setCosmetics(analysis);
            else failCosmetics("Analysis returned no data");
            unsubscribe();
          },
          onError: (msg) => {
            failCosmetics(msg);
            unsubscribe();
          },
        });
        const { id } = await cosmeticsService.uploadCapture(frameDataUrl);
        await cosmeticsService.startSkinAnalysis(id);
      } catch (e) {
        failCosmetics((e as Error)?.message ?? "Skin analysis failed");
        unsubscribe();
      }
    },
    [startCosmetics, setCosmetics, failCosmetics],
  );

  // ── face detection → greet + analyze (fires once) ──
  const onFaceDetected = useCallback(
    (frameDataUrl: string) => {
      setFaceDetected(true);
      // Overview is a downstream dashboard, not an entry screen — it does not
      // greet. It only runs the passive skin analysis. (Greeting belongs to
      // /ai-assistant.)
      void runSkinAnalysis(frameDataUrl);
    },
    [setFaceDetected, runSkinAnalysis],
  );

  const { videoRef, status: trackerStatus } = useFaceTracker({
    onDetect: onFaceDetected,
  });

  // ── voice → ChatWonder tool results (global mic registers to this page) ──
  const pageContext = useMemo(
    () => ({ route: ROUTES.OVERVIEW, pageName: "Overview" }),
    [],
  );

  const handleVoiceAction = useCallback(
    (raw: ChatWonderAction) => {
      const action = raw as OverviewVoiceAction;
      if (action.type !== "GARMENT_RECOMMENDATION") return;

      const response = (action as GarmentRecommendationAction).response;
      const { garments, outfits } = adaptGarmentData(response?.garment_data);
      if (garments.length) setGarments(garments);
      if (outfits.length) setOutfits(outfits);

      const m = adaptMapsData(response?.maps_data?.[0]);
      if (m) setMap(m);
    },
    [setGarments, setOutfits, setMap],
  );

  useVoice(pageContext, handleVoiceAction);

  // ── text-stream tool results (typed ChatWonder window) ──
  const handleChatComplete = useCallback(
    (payload: ChatWonderCompletePayload) => {
      if (payload.garment) {
        const { garments, outfits } = adaptGarmentData(payload.garment);
        if (garments.length) setGarments(garments);
        if (outfits.length) setOutfits(outfits);
      }
      if (payload.maps) {
        const m = adaptMapsData(payload.maps);
        if (m) setMap(m);
      }
    },
    [setGarments, setOutfits, setMap],
  );

  // ── map store → Map tile (the cognitive pipeline sets destinations here) ──
  const selectedDestination = useMapStore((s) => s.selectedDestination);
  const itineraryStops = useMapStore((s) => s.itineraryStops);

  useEffect(() => {
    if (itineraryStops.length > 0) {
      const first = itineraryStops[0];
      setMap({
        name: first.name,
        lat: first.lat,
        lng: first.lng,
        address: first.address,
        stops: itineraryStops.map((s) => ({
          name: s.name,
          lat: s.lat,
          lng: s.lng,
        })),
      });
    } else if (selectedDestination) {
      setMap({
        name: selectedDestination.name,
        lat: selectedDestination.lat,
        lng: selectedDestination.lng,
        address: selectedDestination.address,
      });
    }
  }, [selectedDestination, itineraryStops, setMap]);

  const runOverviewPlan = useCallback(
    async (prompt: string) => {
      const destination = extractLocationFromTranscript(prompt);
      let weatherContext =
        weather?.temp !== null && weather?.temp !== undefined
          ? weatherToChatContext(
              {
                temp: weather.temp,
                condition: weather.condition ?? "",
              },
              { location: weather.city },
            )
          : null;

      if (destination) {
        try {
          const { results } = await mapService.geocode(destination);
          const place = results[0];
          if (place) {
            setMap({
              name: place.name || destination,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
            });
            const destinationWeather = await fetchDestinationWeather(
              place.lat,
              place.lng,
              place.name || destination,
            );
            if (destinationWeather) weatherContext = destinationWeather;
          } else {
            emptyMap();
          }
        } catch (err) {
          failMap(err instanceof Error ? err.message : "Map lookup failed");
        }
      }

      try {
        const response = await requestGarmentsWithFreshSession(
          [
            "[stylist]",
            "Treat date as a romantic/social outing when relevant.",
            "Recommend outfits for this plan using the provided destination weather.",
            `Plan: ${prompt}`,
            destination ? `Destination: ${destination}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          weatherContext,
        );

        const { garments, outfits } = adaptGarmentData(response.garment_data);
        setGarments(garments);
        setOutfits(outfits);

        const mapPayload = Array.isArray(response.maps_data)
          ? response.maps_data[0]
          : response.maps_data;
        const m = adaptMapsData(mapPayload);
        if (m) setMap(m);
      } catch {
        setGarments([]);
        setOutfits([]);
      }
    },
    [emptyMap, failMap, setGarments, setMap, setOutfits, weather],
  );

  // ── handoff from /ai-assistant: run overview tools for the carried prompt ──
  useEffect(() => {
    if (handoffFiredRef.current) return;

    let prompt: string | null = null;
    try {
      prompt = sessionStorage.getItem(OVERVIEW_PROMPT_KEY);
      if (prompt) sessionStorage.removeItem(OVERVIEW_PROMPT_KEY);
    } catch {
      /* sessionStorage unavailable */
    }
    if (!prompt) return;

    handoffFiredRef.current = true;
    cameFromAssistantRef.current = true;

    // Show the tiles as actively loading (skeletons) while the tools resolve.
    setGreeting("Pulling that together for you…");
    startGarments();
    startOutfits();
    startMap();

    void runOverviewPlan(prompt);
    // Fire exactly once on mount; weather is best-effort and may still be null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackerLabel =
    trackerStatus === "detected"
      ? "Recognized"
      : trackerStatus === "searching"
        ? "Looking for you…"
        : trackerStatus === "starting"
          ? "Waking the mirror…"
          : "Camera unavailable";

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden px-8 py-8">
      {/* Off-screen camera — sampled by the face tracker, never shown. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-hidden
        className="absolute w-px h-px opacity-0 pointer-events-none -z-10"
      />

      {/* Header */}
      <div className="flex items-center shrink-0 px-2 mb-4">
        <div className="flex-1 flex items-center">
          <WeatherWidget iconSize={32} />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center">
            <span className="text-white font-semibold text-2xl tracking-wide select-none">
              StyleOS
            </span>
            <LanguageSelector />
          </div>
        </div>
        <div className="flex-1 flex justify-end">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {trackerStatus === "detected" ? (
              <ScanFace className="w-4 h-4 text-emerald-400" />
            ) : trackerStatus === "unavailable" ? (
              <CameraOff className="w-4 h-4 text-white/40" />
            ) : (
              <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
            )}
            <span className="text-white/55 text-xs">{trackerLabel}</span>
          </div>
        </div>
      </div>

      {/* Greeting + identity */}
      <div className="text-center mb-4 shrink-0 min-h-[64px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {greeting ? (
            <motion.h1
              key="greeting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-white font-bold text-3xl tracking-tight glow-text-white"
            >
              {greeting}
            </motion.h1>
          ) : (
            <motion.h1
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white/80 font-bold text-3xl tracking-tight"
            >
              {user?.displayName ?? "Welcome"}
            </motion.h1>
          )}
        </AnimatePresence>
      </div>

      {/* Disclaimer */}
      <div className="mb-4 shrink-0">
        <CameraDisclaimer />
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <OverviewGrid />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-4 shrink-0">
        <button
          onClick={() => router.back()}
          className="text-white/40 hover:text-white text-base transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => router.push(ROUTES.WELCOME)}
          className="logout-btn px-6 py-2.5 text-white text-base font-medium"
        >
          Restart
        </button>
      </div>

      {/* ChatWonder text window — voice is handled by the global mic overlay. */}
      <ChatWonderChat
        mode="overview"
        weather={weather}
        onComplete={handleChatComplete}
      />
    </div>
  );
}
