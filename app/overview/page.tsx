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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import "../../styles/glow.css";

import { ROUTES } from "@/navigation";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { mapService } from "@/modules/map/services/map.service";
import { extractLocationFromTranscript } from "@/modules/map/utils/chatWonderMapUtils";
import { useMapStore } from "@/modules/map/store/useMapStore";

import {
  OverviewGrid,
  CameraDisclaimer,
  useOverviewStore,
  adaptGarmentData,
  adaptCosmeticsData,
  adaptMapsData,
  adaptOutlineToTiles,
  OVERVIEW_PROMPT_KEY,
} from "@/modules/overview";
import { outlineService } from "@/modules/shared/api/outline.service";
import { useProximitySensor } from "@/modules/shared/hooks/useProximitySensor";
import MirrorHeader from "@/components/MirrorHeader";
import {
  QuickResponseChips,
  getToday,
  nextWeekday,
} from "@/components/QuickResponseChips";

// The voice pipeline emits this extended action (not part of the base union)
// when a garment recommendation resolves; narrow against it safely.
type GarmentRecommendationAction = {
  type: "GARMENT_RECOMMENDATION";
  response?: {
    garment_data?: unknown;
    maps_data?: unknown[];
    cosmetics_data?: unknown;
  };
};
type OverviewVoiceAction = ChatWonderAction | GarmentRecommendationAction;

type OverviewLocationContext = { lat: number; lng: number };

async function requestGarmentsWithFreshSession(
  input: string,
  location?: OverviewLocationContext | null,
) {
  // Overview produces a cosmetics tile, which ChatWonder can only fill when it
  // receives the skin analysis (ADR 0002). Pass it on both the initial call and
  // the post-409 retry. Weather is resolved server-side from the location.
  const skinAnalysis = useMirrorStore.getState().skinAnalysisResult;
  const payload = {
    input,
    pageMode: "overview" as const,
    ...(location
      ? {
          location: {
            lat: location.lat.toString(),
            lng: location.lng.toString(),
          },
        }
      : {}),
    ...(skinAnalysis ? { skinAnalysis } : {}),
  };
  try {
    return await chatWonderService.message(payload);
  } catch (err) {
    if (err instanceof Error && err.message.includes("HTTP 409")) {
      await chatWonderService.restart();
      return chatWonderService.message(payload);
    }
    throw err;
  }
}

export default function OverviewPage() {
  const user = useAuthStore((s) => s.user);

  // ── store actions (stable refs) ──
  const setFaceDetected = useOverviewStore((s) => s.setFaceDetected);
  const setGreeting = useOverviewStore((s) => s.setGreeting);
  const emptyMap = useOverviewStore((s) => s.emptyMap);
  const startGarments = useOverviewStore((s) => s.startGarments);
  const setGarments = useOverviewStore((s) => s.setGarments);
  const startOutfits = useOverviewStore((s) => s.startOutfits);
  const setOutfits = useOverviewStore((s) => s.setOutfits);
  const startCosmetics = useOverviewStore((s) => s.startCosmetics);
  const setCosmetics = useOverviewStore((s) => s.setCosmetics);
  const setSkinAnalysis = useOverviewStore((s) => s.setSkinAnalysis);
  const startMap = useOverviewStore((s) => s.startMap);
  const setMap = useOverviewStore((s) => s.setMap);
  const failMap = useOverviewStore((s) => s.failMap);

  const greeting = useOverviewStore((s) => s.greeting);

  // Explicit gate for the full-screen loader: true while the initial Outline
  // hydration is in flight (so we don't flash empty tiles before data arrives),
  // and while any tile is actively resolving a live request.
  const [hydrating, setHydrating] = useState(true);

  const garmentsLoading = useOverviewStore(
    (s) => s.garments.status === "loading",
  );
  const outfitsLoading = useOverviewStore(
    (s) => s.outfits.status === "loading",
  );
  const cosmeticsLoading = useOverviewStore(
    (s) => s.cosmetics.status === "loading",
  );
  const mapLoading = useOverviewStore((s) => s.map.status === "loading");

  const isLoading =
    hydrating ||
    garmentsLoading ||
    outfitsLoading ||
    cosmeticsLoading ||
    mapLoading;

  // True when we arrived here from /ai-assistant carrying a spoken prompt —
  // suppresses the face-detection greeting (the assistant already greeted).
  const cameFromAssistantRef = useRef(false);
  const handoffFiredRef = useRef(false);

  // ── no longer reset the grid whenever a fresh session lands here ──
  // because we route here from /ai-assistant and need to preserve the data we just caught.

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
        const { garments, outfits, cosmetics, skinAnalysis } =
          adaptOutlineToTiles(outline);
        setGarments(garments);
        setOutfits(outfits);
        setCosmetics(cosmetics);
        setSkinAnalysis(skinAnalysis);
        void useMapStore.getState().loadOutlineStops();
      } catch {
        /* hydration is best-effort; live updates still populate the tiles */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setGarments, setOutfits, setCosmetics, setSkinAnalysis]);

  // ── face detection → greet (fires once) ──
  const onFaceDetected = useCallback(() => {
    setFaceDetected(true);
    // Overview is a downstream dashboard, not an entry screen — it does not
    // greet. (Greeting belongs to /ai-assistant.)
  }, [setFaceDetected]);

  const router = useRouter();

  const {
    videoRef,
    isPresent,
    captureFrame,
  } = useProximitySensor({
    intervalMs: 1000,
    missesUntilExit: 3,
  });

  const hasCapturedRef = useRef(false);
  useEffect(() => {
    if (isPresent && !hasCapturedRef.current) {
      hasCapturedRef.current = true;
      const frame = captureFrame();
      if (frame) {
        onFaceDetected();
      }
    }
  }, [isPresent, captureFrame, onFaceDetected]);

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
      // Preserve semantics: a turn that doesn't mention a section leaves that
      // tile as-is (don't stomp hydrated/earlier data with an empty result).
      const { garments, outfits } = adaptGarmentData(response?.garment_data);
      if (garments.length) setGarments(garments);
      if (outfits.length) setOutfits(outfits);

      const cosmetics = adaptCosmeticsData(response?.cosmetics_data);
      if (cosmetics.length) setCosmetics(cosmetics);

      const m = adaptMapsData(response?.maps_data?.[0]);
      if (m) setMap(m);
    },
    [setGarments, setOutfits, setCosmetics, setMap],
  );

  useVoice(pageContext, handleVoiceAction);

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
      // Location for weather: prefer the geocoded destination, fall back to the
      // user's current GPS position. The backend resolves weather from location.
      let locationCtx: OverviewLocationContext | null = null;

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
            locationCtx = { lat: place.lat, lng: place.lng };
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
            `Plan: ${prompt}`,
            destination ? `Destination: ${destination}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          locationCtx,
        );

        const { garments, outfits } = adaptGarmentData(response.garment_data);
        setGarments(garments);
        setOutfits(outfits);

        const cosmetics = adaptCosmeticsData(response.cosmetics_data);
        setCosmetics(cosmetics);

        const mapPayload = Array.isArray(response.maps_data)
          ? response.maps_data[0]
          : response.maps_data;
        const m = adaptMapsData(mapPayload);
        if (m) setMap(m);
      } catch {
        setGarments([]);
        setOutfits([]);
        setCosmetics([]);
      }
    },
    [emptyMap, failMap, setGarments, setMap, setOutfits, setCosmetics],
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
    startCosmetics();
    startMap();

    void runOverviewPlan(prompt);
    // Fire exactly once on mount; weather is best-effort and may still be null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-hidden
        className="absolute w-px h-px opacity-0 pointer-events-none -z-10"
      />

      <MirrorHeader
        className="w-full"
        style={{
          background: "transparent",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
        onBack={() => router.back()}
      />

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

      {/* Quick Response Chips — inline below greeting, voice idle only */}
      <QuickResponseChips
        className="shrink-0 pb-2"
        prompts={[
          `Give me a complete style and wellness briefing for today, ${getToday()} — outfit, skincare, and where to go.`,
          `I have a special event this ${nextWeekday(5)} — plan my full look, skincare prep, and route to get there.`,
          "Show me everything in my current session plan — outfit picks, skincare products, and mapped stops.",
          "I want to look and feel my best — build me a complete outfit, skincare routine, and destination guide.",
          "Summarize my skin profile, suggest the best outfit for today, and show me somewhere great to eat nearby.",
        ]}
      />

      {/* Grid */}
      <div className="flex-1 min-h-0 flex flex-col">
        <OverviewGrid />
      </div>

      {/* Footer (Manual buttons removed for full-voice experience) */}
      <div className="flex justify-between items-center mt-4 shrink-0">
        {/* Buttons previously here were removed */}
      </div>

      {/* Full-screen video loader overlay when resolving data */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: 0.5, ease: "easeInOut" },
            }}
            className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden"
          >
            <video
              src="https://videos.pexels.com/video-files/3129671/3129671-uhd_3840_2160_30fps.mp4"
              autoPlay
              muted
              loop
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
            {greeting && (
              <motion.h1
                key="greeting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative z-10 text-white font-bold text-4xl tracking-tight drop-shadow-2xl px-8 text-center leading-snug"
              >
                {greeting}
              </motion.h1>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
