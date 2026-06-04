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
 *
 * The previous "Jump to a feature" menu is preserved in ./LegacyOverviewMenu.tsx.
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
import {
  useChatWonderStream,
  type ChatWonderCompletePayload,
} from "@/modules/shared/ai/useChatWonderStream";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
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
  OVERVIEW_PROMPT_KEY,
} from "@/modules/overview";

const GREETING = "Hi! What can I do for you?";

// The voice pipeline emits this extended action (not part of the base union)
// when a garment recommendation resolves; narrow against it safely.
type GarmentRecommendationAction = {
  type: "GARMENT_RECOMMENDATION";
  response?: { garment_data?: unknown; maps_data?: unknown[] };
};
type OverviewVoiceAction = ChatWonderAction | GarmentRecommendationAction;

/** Best-effort TTS playback of the greeting (mirrors the chat-stream pattern). */
async function speak(text: string) {
  try {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("access_token") || ""
        : "";
    const res = await fetch("/api/mirror/voice/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    void new Audio(url).play().catch(() => {});
  } catch {
    /* TTS is best-effort */
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
  const reset = useOverviewStore((s) => s.reset);

  const greeting = useOverviewStore((s) => s.greeting);

  // Programmatic ChatWonder channel used to re-fire a prompt handed over from
  // /ai-assistant (separate instance from the visible ChatWonderChat window).
  const { sendMessage } = useChatWonderStream();
  // True when we arrived here from /ai-assistant carrying a spoken prompt —
  // suppresses the face-detection greeting (the assistant already greeted).
  const cameFromAssistantRef = useRef(false);
  const handoffFiredRef = useRef(false);

  // ── reset the grid whenever a fresh session lands here ──
  useEffect(() => {
    reset();
    return () => reset();
  }, [reset]);

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
      // Skip the greeting/TTS if the assistant already greeted before handoff.
      if (!cameFromAssistantRef.current) {
        setGreeting(GREETING);
        void speak(GREETING);
      }
      void runSkinAnalysis(frameDataUrl);
    },
    [setFaceDetected, setGreeting, runSkinAnalysis],
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

  // ── handoff from /ai-assistant: re-fire the carried prompt through ChatWonder ──
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

    void sendMessage(prompt, {
      mode: "overview",
      weather,
      onComplete: handleChatComplete,
    });
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
          onClick={() => router.push(ROUTES.LOGGED_IN)}
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
