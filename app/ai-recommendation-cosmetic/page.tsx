"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/navigation";
import { api } from "@/modules/shared/api/api-client";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { ChatWonderChat } from "@/modules/shared/ai/ChatWonderChat";
import { useWeather } from "@/modules/shared/hooks/useWeather";
import {
  useFaceAlignment,
  type AlignState,
} from "@/modules/shared/hooks/useFaceAlignment";

// ── On-screen guidance copy for each alignment state ──────────────────────────
function guidanceFor(state: AlignState): string {
  switch (state) {
    case "starting":
      return "Starting camera…";
    case "unavailable":
      return "Camera unavailable — please check permissions.";
    case "too-far":
      return "Move a little closer";
    case "too-close":
      return "Move back a bit";
    case "off-center":
      return "Center your face in the circle";
    case "aligned":
      return "Hold still…";
    case "captured":
      return "Got it! Analyzing your skin…";
    case "no-face":
    case "searching":
    default:
      return "Position your face in the circle";
  }
}

// ── Skeleton product card — placeholder mirroring the recommendation grid ─────
function SkeletonCard({ delay }: { delay: number }) {
  const shimmer = {
    animate: { opacity: [0.35, 0.7, 0.35] },
    transition: {
      duration: 1.4,
      repeat: Infinity,
      delay,
      ease: "easeInOut" as const,
    },
  };
  return (
    <div
      style={{
        borderRadius: "14px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Image area */}
      <motion.div
        {...shimmer}
        style={{ flex: "0 0 52%", background: "rgba(255,255,255,0.06)" }}
      />
      {/* Text lines */}
      <div
        style={{
          flex: 1,
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          justifyContent: "center",
        }}
      >
        <motion.div
          {...shimmer}
          style={{
            height: 7,
            width: "55%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <motion.div
          {...shimmer}
          style={{
            height: 9,
            width: "85%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.10)",
          }}
        />
        <motion.div
          {...shimmer}
          style={{
            height: 7,
            width: "40%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
          }}
        />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CosmeticPage() {
  const router = useRouter();
  const [captured, setCaptured] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const storeAiSuggestion = useMirrorStore((state) => state.aiSuggestion);
  const { weather } = useWeather();

  // ── Capture handoff — store the aligned frame and move to the results page ────
  const handleCapture = useCallback(
    (dataUrl: string) => {
      setCaptured(true); // triggers the white flash
      try {
        sessionStorage.setItem("skin_capture", dataUrl);
        sessionStorage.removeItem("skin_analysis");
        sessionStorage.removeItem("skin_analysis_id");
      } catch {}
      // Navigate after the flash — the recommendation page handles
      // upload + analyze + product fetch (shows the skeleton meanwhile).
      window.setTimeout(
        () => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RECOMMENDATION),
        600,
      );
    },
    [router],
  );

  // Live face preview + centering/distance guidance. Auto-captures once the
  // face is centered and close enough and held steady for a moment.
  const { videoRef, state, progress, retry } = useFaceAlignment({
    onCapture: handleCapture,
  });

  const isError = state === "unavailable";
  const isAligned = state === "aligned" || state === "captured";
  const caption = guidanceFor(state);

  // ── Weather-based skincare tip (banner) ──────────────────────────────────────
  useEffect(() => {
    const fetchSuggestion = async () => {
      if (storeAiSuggestion) {
        setAiSuggestion(storeAiSuggestion);
        return;
      }
      try {
        const { useMapStore } = await import("@/modules/map/store/useMapStore");
        const location = useMapStore.getState().userLocation;
        const res = await api.post<{ suggestion: string }>(
          "/api/mirror/voice/suggest",
          {
            type: "cosmetics",
            ctx: { lat: location?.lat, lng: location?.lng },
          },
        );
        if (res.data?.suggestion) {
          setAiSuggestion(res.data.suggestion);
          useMirrorStore.getState().setAiSuggestion(res.data.suggestion);
        }
      } catch (err) {
        console.error("Failed to auto-fetch suggestion:", err);
      }
    };
    fetchSuggestion();
  }, [storeAiSuggestion]);

  // ── Render — mirrors the recommendation screen layout ────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      {/* Header */}
      <header
        className="flex items-center shrink-0 py-4 px-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-white/80 active:text-white transition-colors"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
        <h1 className="flex-1 text-center text-white font-bold text-2xl pr-9">
          Skin Analysis
        </h1>
      </header>

      {/* AI suggestion tip — compact, clamped so it can't take over the screen */}
      <AnimatePresence>
        {aiSuggestion && (
          <motion.div
            className="shrink-0 px-4 pt-3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="p-2.5 rounded-xl flex items-center gap-2.5"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
              }}
            >
              <span className="text-base shrink-0">✨</span>
              <p
                className="text-white/85 text-xs font-medium leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {aiSuggestion}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body — same structure as the recommendation screen */}
      <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
        {/* Camera preview — sits exactly where the captured photo will appear */}
        <div className="flex justify-center shrink-0 px-4 pt-3">
          <div
            style={{
              position: "relative",
              height: "32vh",
              aspectRatio: "3 / 4",
              borderRadius: "14px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {/* Live camera preview — the user can see and center themselves.
                Mirrored so it reads like a mirror. */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full"
              style={{
                position: "absolute",
                inset: 0,
                objectFit: "cover",
                objectPosition: "center top",
                transform: "scaleX(-1)",
                display: isError ? "none" : "block",
              }}
            />

            {/* Face-alignment guide — an oval the user lines their face up with.
                It turns green and a ring fills while the face is held aligned. */}
            {!isError && (
              <svg
                viewBox="0 0 100 133"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
                fill="none"
              >
                {/* Guide oval */}
                <motion.ellipse
                  cx={50}
                  cy={60}
                  rx={33}
                  ry={43}
                  stroke={isAligned ? "#48C78E" : "rgba(255,255,255,0.85)"}
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  animate={
                    isAligned
                      ? { strokeOpacity: 1 }
                      : { strokeOpacity: [0.45, 0.9, 0.45] }
                  }
                  transition={
                    isAligned
                      ? { duration: 0.3 }
                      : { duration: 1.8, repeat: Infinity }
                  }
                />
                {/* Capture progress ring (fills clockwise from the top) */}
                <ellipse
                  cx={50}
                  cy={60}
                  rx={33}
                  ry={43}
                  stroke="#48C78E"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={`${progress} 1`}
                  transform="rotate(-90 50 60)"
                  style={{ filter: "drop-shadow(0 0 4px #48C78E)" }}
                />
              </svg>
            )}

            {/* White flash on capture */}
            <AnimatePresence>
              {captured && (
                <motion.div
                  key="capture-flash"
                  className="absolute inset-0 bg-white pointer-events-none"
                  initial={{ opacity: 0.85 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.55 }}
                />
              )}
            </AnimatePresence>

            {/* Caption strip at the bottom of the preview */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "18px 10px 8px",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: isError
                    ? "rgba(248,113,113,0.95)"
                    : isAligned
                      ? "rgba(72,199,142,0.95)"
                      : "rgba(255,255,255,0.85)",
                }}
              >
                {caption}
              </span>
            </div>
          </div>
        </div>

        {/* Skeleton product grid — placeholder for the upcoming recommendations */}
        <div
          className="flex-1 px-4 pb-3 pt-3"
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Recommended Products
            </span>
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ color: "rgba(72,199,142,0.8)", fontSize: "10px" }}
            >
              ✦ preparing…
            </motion.span>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(1, 1fr)",
              gap: "10px",
            }}
          >
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} delay={i * 0.2} />
            ))}
          </div>
        </div>
      </div>

      {/* No manual controls — capture is fully automatic. Retry only on a hard
          camera error. */}
      {isError && (
        <div className="shrink-0 pb-6 flex justify-center">
          <button
            onClick={retry}
            className="px-9 py-3 rounded-full font-semibold text-sm tracking-wide"
            style={{
              background: "rgba(72,199,142,0.18)",
              border: "1px solid rgba(72,199,142,0.55)",
              color: "rgba(72,199,142,0.95)",
              backdropFilter: "blur(8px)",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ChatWonder Chat overlay */}
      <ChatWonderChat mode="cosmetics" weather={weather} />
    </div>
  );
}
