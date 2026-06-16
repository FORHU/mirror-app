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

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import "../../styles/glow.css";

import { ROUTES } from "@/navigation";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import {
  OverviewGrid,
  useOverviewStore,
  adaptOutlineToTiles,
  OVERVIEW_PROMPT_KEY,
} from "@/modules/overview";
import { outlineService } from "@/modules/shared/api/outline.service";
import MirrorHeader from "@/components/MirrorHeader";
import { useWeather } from "@/modules/shared/hooks/useWeather";
import { useOverviewDataQuery } from "./queries";

export default function OverviewPage() {
  // ── store actions (stable refs) ──
  const setGreeting = useOverviewStore((s) => s.setGreeting);
  const greeting = useOverviewStore((s) => s.greeting);
  const setSkinAnalysis = useOverviewStore((s) => s.setSkinAnalysis);

  // We only need the snapshots for initial hydration
  const overviewFashionSnapshot = useMirrorStore(
    (s) => s.overviewFashionSnapshot,
  );
  const overviewCosmeticsSnapshot = useMirrorStore(
    (s) => s.overviewCosmeticsSnapshot,
  );
  const skinAnalysisResult = useMirrorStore((s) => s.skinAnalysisResult);

  const pendingPrompt = useOverviewStore((s) => s.pendingPrompt);
  const setPendingPrompt = useOverviewStore((s) => s.setPendingPrompt);
  const category = useOverviewStore((s) => s.pendingCategory);
  const gender = useOverviewStore((s) => s.pendingGender);

  const { weather, coords } = useWeather();
  const router = useRouter();

  const [hydrating, setHydrating] = useState(true);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  const cameFromAssistantRef = useRef(false);
  const handoffFiredRef = useRef(false);

  // ── hybrid hydration: reflect the persisted Outline on arrival ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const outline = await outlineService.getOrCreate();
        if (cancelled) return;
        const { outfits, cosmetics, skinAnalysis } =
          adaptOutlineToTiles(outline);

        if (!handoffFiredRef.current) {
          if (outfits.length) {
            useMirrorStore
              .getState()
              .setOverviewFashionSnapshot({ garments: [], outfits });
          }
          if (cosmetics.length) {
            useMirrorStore.getState().setOverviewCosmeticsSnapshot(cosmetics);
          }
        }
        if (skinAnalysis) setSkinAnalysis(skinAnalysis);
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSkinAnalysis]);

  // ── handoff from /ai-assistant ──
  useEffect(() => {
    let prompt = pendingPrompt;
    if (!prompt) {
      try {
        prompt = sessionStorage.getItem(OVERVIEW_PROMPT_KEY);
      } catch {}
    }

    try {
      const savedCategory = sessionStorage.getItem("mirror_fashion_category");
      if (savedCategory)
        useOverviewStore.getState().setPendingCategory(savedCategory);

      const savedGender = sessionStorage.getItem("mirror_fashion_gender");
      if (savedGender && savedGender !== "null") {
        useOverviewStore
          .getState()
          .setPendingGender(savedGender as "MALE" | "FEMALE");
      } else if (savedGender === "null") {
        useOverviewStore.getState().setPendingGender(null);
      }
    } catch {}

    if (prompt) {
      let finalPrompt = prompt;
      if (prompt.startsWith("__SILENT__: ")) {
        finalPrompt = prompt.replace("__SILENT__: ", "");
      } else if (prompt.startsWith("__SILENT__:!")) {
        finalPrompt = prompt.replace("__SILENT__:!", "");
      } else if (prompt.startsWith("__SILENT__:! ")) {
        finalPrompt = prompt.replace("__SILENT__:! ", "");
      } else if (prompt.startsWith("__SILENT__:!")) {
        finalPrompt = prompt.replace("__SILENT__:!", "");
      } else if (prompt.startsWith("__SILENT__:")) {
        finalPrompt = prompt.replace("__SILENT__:", "");
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePrompt(finalPrompt);
      setPendingPrompt(null);
      handoffFiredRef.current = true;
      cameFromAssistantRef.current = true;
      setGreeting("Pulling that together for you…");
    }
  }, [pendingPrompt, setPendingPrompt, setGreeting]);

  // ── React Query Fetching ──
  const overviewQuery = useOverviewDataQuery(
    activePrompt,
    weather as unknown as Record<string, unknown>,
    category,
    gender,
    skinAnalysisResult,
    coords,
  );

  const isLoading = hydrating || overviewQuery.isFetching;

  // Sync back to store for global snapshots
  useEffect(() => {
    if (overviewQuery.data?.outfits) {
      useMirrorStore
        .getState()
        .setOverviewFashionSnapshot(overviewQuery.data.outfits);
    }
  }, [overviewQuery.data?.outfits]);

  useEffect(() => {
    // Only overwrite the persisted snapshot with a non-empty result — an empty
    // array is truthy and would otherwise wipe a good snapshot for good.
    if (overviewQuery.data?.cosmetics?.length) {
      useMirrorStore
        .getState()
        .setOverviewCosmeticsSnapshot(overviewQuery.data.cosmetics);
    }
  }, [overviewQuery.data?.cosmetics]);

  // ── redirect to AI Assistant when there's nothing to show ──
  useEffect(() => {
    if (hydrating) return;
    if (activePrompt) return;
    if (overviewQuery.isFetching) return;
    if (
      overviewQuery.data?.outfits?.outfits?.length ||
      overviewQuery.data?.cosmetics?.length
    )
      return;
    if (
      overviewFashionSnapshot?.outfits?.length ||
      overviewCosmeticsSnapshot?.length
    )
      return;

    router.replace(ROUTES.AI_ASSISTANT);
  }, [
    hydrating,
    router,
    activePrompt,
    overviewQuery.isFetching,
    overviewQuery.data,
    overviewFashionSnapshot,
    overviewCosmeticsSnapshot,
  ]);

  // Create query-based state for OverviewGrid props
  // Use React Query data if we fetched it, otherwise fall back to the snapshot (for direct navigation without a new prompt)
  const outfitsState = useMemo(() => {
    const data = overviewQuery.data?.outfits ||
      overviewFashionSnapshot || { garments: [], outfits: [] };
    const hasData = data.outfits.length > 0 || data.garments.length > 0;
    return {
      status: overviewQuery.isFetching
        ? "loading"
        : overviewQuery.isError
          ? "error"
          : hasData
            ? "ready"
            : "idle",
      data,
      error: overviewQuery.error?.message ?? null,
    } as const;
  }, [
    overviewQuery.isFetching,
    overviewQuery.isError,
    overviewQuery.error,
    overviewQuery.data,
    overviewFashionSnapshot,
  ]);

  const cosmeticsState = useMemo(() => {
    const data =
      (overviewQuery.data?.cosmetics?.length
        ? overviewQuery.data.cosmetics
        : null) ||
      overviewCosmeticsSnapshot ||
      [];
    const hasData = data.length > 0;
    return {
      status: overviewQuery.isFetching
        ? "loading"
        : overviewQuery.isError
          ? "error"
          : hasData
            ? "ready"
            : "idle",
      data,
      error: overviewQuery.error?.message ?? null,
    } as const;
  }, [
    overviewQuery.isFetching,
    overviewQuery.isError,
    overviewQuery.error,
    overviewQuery.data,
    overviewCosmeticsSnapshot,
  ]);

  const skinAnalysisState = useMemo(
    () => ({
      status: "idle" as const,
      data:
        useOverviewStore.getState().skinAnalysis.data ||
        (skinAnalysisResult
          ? { ...skinAnalysisResult, imageUrl: null }
          : null) ||
        null,
      error: null,
    }),
    [skinAnalysisResult],
  );

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
        <OverviewGrid
          outfits={outfitsState}
          cosmetics={cosmeticsState}
          skinAnalysis={skinAnalysisState}
        />
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
            className="fixed inset-0 z-9999 bg-canvas flex flex-col items-center justify-center overflow-hidden"
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            >
              <source
                src="https://d1bdogktone6hj.cloudfront.net/uploads/loading.mp4"
                type="video/mp4"
              />
              <source
                src="https://videos.pexels.com/video-files/3129671/3129671-uhd_3840_2160_30fps.mp4"
                type="video/mp4"
              />
            </video>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative z-10 mt-8 flex items-center justify-center gap-3"
            >
              <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-3 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
