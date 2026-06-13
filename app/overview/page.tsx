"use client";

/**
 * /overview — the session dashboard.
 *
 * Data sources (in priority order):
 *  1. Outline hydration — getOrCreate() ensures an outline always exists.
 *     If the user visited fashion or cosmetics, the outline already has that
 *     department's data and tiles fill immediately.
 *  2. Handoff prompt from /ai-assistant → ChatWonder live request → overwrites tiles.
 *  3. Snapshots from prior pages (fashion / cosmetics) in the mirror store.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import "../../styles/glow.css";

import { ROUTES } from "@/navigation";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import {
  OverviewGrid,
  useOverviewStore,
  adaptGarmentData,
  adaptRemoteOutfitsToTiles,
  adaptCosmeticsData,
  adaptOutlineToTiles,
  OVERVIEW_PROMPT_KEY,
} from "@/modules/overview";
import { outfitService } from "@/modules/shared/api/outfit.service";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import { outlineService } from "@/modules/shared/api/outline.service";
import MirrorHeader from "@/components/MirrorHeader";
import { useWeather } from "@/modules/shared/hooks/useWeather";

// The voice pipeline emits this extended action (not part of the base union)
// when a garment recommendation resolves; narrow against it safely.
type GarmentRecommendationAction = {
  type: "GARMENT_RECOMMENDATION";
  response?: {
    garment_data?: unknown;
    cosmetics_data?: unknown;
  };
};
type OverviewVoiceAction = ChatWonderAction | GarmentRecommendationAction;

async function requestGarmentsWithFreshSession(
  input: string,
  weather?: Record<string, unknown> | null,
  skinAnalysis?: SkinAnalysis | null,
) {
  const payload = {
    input,
    pageMode: "overview" as const,
    ...(weather ? { weather } : {}),
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
  // ── store actions (stable refs) ──
  const setGreeting = useOverviewStore((s) => s.setGreeting);
  const setGarments = useOverviewStore((s) => s.setGarments);
  const startOutfits = useOverviewStore((s) => s.startOutfits);
  const setOutfits = useOverviewStore((s) => s.setOutfits);
  const startCosmetics = useOverviewStore((s) => s.startCosmetics);
  const setCosmetics = useOverviewStore((s) => s.setCosmetics);
  const setSkinAnalysis = useOverviewStore((s) => s.setSkinAnalysis);

  const greeting = useOverviewStore((s) => s.greeting);
  const overviewFashionSnapshot = useMirrorStore(
    (s) => s.overviewFashionSnapshot,
  );
  const overviewCosmeticsSnapshot = useMirrorStore(
    (s) => s.overviewCosmeticsSnapshot,
  );
  const pendingCosmeticsData = useMirrorStore((s) => s.pendingCosmeticsData);
  const chatCosmeticsData = useMirrorStore((s) => s.chatCosmeticsData);
  const skinAnalysisResult = useMirrorStore((s) => s.skinAnalysisResult);

  const { weather } = useWeather();

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

  const isLoading =
    hydrating || garmentsLoading || outfitsLoading || cosmeticsLoading;

  // True when we arrived here from /ai-assistant carrying a spoken prompt —
  // suppresses the face-detection greeting (the assistant already greeted).
  const cameFromAssistantRef = useRef(false);
  const handoffFiredRef = useRef(false);

  // ── hybrid hydration: reflect the persisted Outline on arrival ──
  // Overview is a downstream dashboard, so on mount we fill the tiles from the
  // user's saved Outline. Live ChatWonder updates overwrite these afterward.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const outline = await outlineService.getOrCreate();
        if (cancelled) return;
        const { outfits, cosmetics, skinAnalysis } =
          adaptOutlineToTiles(outline);
        // Skip overwriting tiles the handoff already set to "loading" — letting
        // outline data flip them to "ready" here hides the overlay while the AI
        // call is still running, flashing stale data on screen for several seconds.
        if (!handoffFiredRef.current) {
          // Only fill tiles that are still idle — if ai-assistant already started
          // a fetch (status "loading"), leave them alone so the in-flight request
          // fills them without a stale-data flash.
          const st = useOverviewStore.getState();
          if (outfits.length && st.outfits.status === "idle") setOutfits(outfits);
          if (cosmetics.length && st.cosmetics.status === "idle") setCosmetics(cosmetics);
        }
        if (skinAnalysis) setSkinAnalysis(skinAnalysis);
      } catch {
        /* hydration is best-effort; live updates still populate the tiles */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setOutfits, setCosmetics, setSkinAnalysis]);

  const router = useRouter();

  useEffect(() => {
    if (handoffFiredRef.current) return;

    if (overviewFashionSnapshot?.garments.length) {
      setGarments(overviewFashionSnapshot.garments);
    }
    if (overviewFashionSnapshot?.outfits.length) {
      setOutfits(overviewFashionSnapshot.outfits);
    }
    const cosmetics = overviewCosmeticsSnapshot?.length
      ? overviewCosmeticsSnapshot
      : adaptCosmeticsData(
          pendingCosmeticsData ??
            chatCosmeticsData ??
            skinAnalysisResult?.recommendations ??
            [],
        );
    if (cosmetics.length) {
      setCosmetics(cosmetics);
      useMirrorStore.getState().setOverviewCosmeticsSnapshot(cosmetics);
    }
  }, [
    overviewFashionSnapshot,
    overviewCosmeticsSnapshot,
    pendingCosmeticsData,
    chatCosmeticsData,
    skinAnalysisResult?.recommendations,
    setGarments,
    setOutfits,
    setCosmetics,
    setSkinAnalysis,
  ]);

  // ── voice → ChatWonder tool results (global mic registers to this page) ──
  const pageContext = useMemo(
    () => ({
      route: ROUTES.OVERVIEW,
      pageName: "Overview",
      mode: "overview" as const,
    }),
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
    },
    [setGarments, setOutfits, setCosmetics],
  );

  useVoice(pageContext, handleVoiceAction);

  const runOverviewPlan = useCallback(
    async (prompt: string) => {
      try {
        const response = await requestGarmentsWithFreshSession(
          `[stylist] Plan: ${prompt}`,
          weather as Record<string, unknown> | null,
          skinAnalysisResult,
        );

        const rawGarmentData = response.garment_data as Record<
          string,
          unknown
        > | null;
        const garmentQuery =
          typeof rawGarmentData?.query === "string"
            ? rawGarmentData.query
            : null;

        if (garmentQuery) {
          const fetchedOutfits = await outfitService.getByQuery(garmentQuery);
          const { garments, outfits } =
            adaptRemoteOutfitsToTiles(fetchedOutfits);

          if (garments.length > 0 || outfits.length > 0) {
            setGarments(garments);
            setOutfits(outfits);
          } else {
            // Fallback: If DB search yields nothing, use the LLM's generated sets (if any)
            const fallback = adaptGarmentData({
              ...rawGarmentData,
              query: undefined,
            });
            setGarments(fallback.garments);
            setOutfits(fallback.outfits);
          }
        } else {
          const { garments, outfits } = adaptGarmentData(response.garment_data);
          setGarments(garments);
          setOutfits(outfits);
        }

        const rawCosmeticsData = response.cosmetics_data as Record<
          string,
          unknown
        > | null;
        const cosmeticsQuery =
          typeof rawCosmeticsData?.query === "string"
            ? rawCosmeticsData.query
            : null;
        if (cosmeticsQuery) {
          const fetchedProducts =
            await cosmeticsService.getByQuery(cosmeticsQuery);
          setCosmetics(adaptCosmeticsData(fetchedProducts));
        } else {
          setCosmetics(adaptCosmeticsData(response.cosmetics_data));
        }
      } catch {
        setGarments([]);
        setOutfits([]);
        setCosmetics([]);
      }
    },
    [setGarments, setOutfits, setCosmetics, weather, skinAnalysisResult],
  );

  // ── handoff from /ai-assistant: run overview tools for the carried prompt ──
  const pendingPrompt = useOverviewStore((s) => s.pendingPrompt);
  const setPendingPrompt = useOverviewStore((s) => s.setPendingPrompt);

  useEffect(() => {
    let prompt: string | null = pendingPrompt;

    // Fallback to sessionStorage in case of hard refresh or direct nav
    if (!prompt) {
      try {
        prompt = sessionStorage.getItem(OVERVIEW_PROMPT_KEY);
        if (prompt) sessionStorage.removeItem(OVERVIEW_PROMPT_KEY);
      } catch {
        /* sessionStorage unavailable */
      }
    }

    if (!prompt) return;

    setPendingPrompt(null);
    handoffFiredRef.current = true;
    cameFromAssistantRef.current = true;

    // Normal path: ai-assistant already started the fetch and set tiles to
    // "loading" — just let it finish. Hard-refresh path: the store was cleared
    // so tiles are idle; re-run the plan from here as a fallback.
    if (useOverviewStore.getState().outfits.status === "idle") {
      setGreeting("Pulling that together for you…");
      startOutfits();
      startCosmetics();
      void runOverviewPlan(prompt);
    }
  }, [
    pendingPrompt,
    setPendingPrompt,
    setGreeting,
    startOutfits,
    startCosmetics,
    runOverviewPlan,
  ]);

  return (
    <div className="w-screen h-screen bg-canvas flex flex-col overflow-hidden">
      <MirrorHeader
        className="w-full relative z-20"
        style={{
          background: "transparent",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
        onBack={() => router.back()}
      />

      {/* Grid */}
      <div className="m-5 flex-1 min-h-0 flex flex-col relative z-10 pb-24">
        <OverviewGrid />
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
            className="fixed inset-0 z-[9999] bg-canvas flex flex-col items-center justify-center overflow-hidden"
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
