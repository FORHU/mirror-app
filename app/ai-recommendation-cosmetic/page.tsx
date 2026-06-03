"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/navigation";
import { api } from "@/modules/shared/api/api-client";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { ChatWonderChat } from "@/modules/shared/ai/ChatWonderChat";
import { useWeather } from "@/modules/shared/hooks/useWeather";

// Seconds of countdown before the photo is taken automatically.
const COUNTDOWN_FROM = 3;

// starting  → acquiring the camera
// countdown → 3-2-1 before auto-capture
// captured  → frame grabbed, white flash, navigating to results
type Phase = "starting" | "countdown" | "captured";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("starting");

  const [phase, setPhase] = useState<Phase>("starting");
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const storeAiSuggestion = useMirrorStore((state) => state.aiSuggestion);
  const { weather } = useWeather();

  const setPhaseState = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

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

  // ── Capture the current frame and hand off to the result page ────────────────
  const captureFrame = useCallback(async () => {
    if (phaseRef.current === "captured") return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    try {
      sessionStorage.setItem("skin_capture", dataUrl);
      sessionStorage.removeItem("skin_analysis");
      sessionStorage.removeItem("skin_analysis_id");
    } catch {}

    setPhaseState("captured"); // triggers white flash
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Navigate after the flash — the recommendation page now handles
    // upload + analyze + product fetch (shows the skeleton meanwhile).
    await new Promise((r) => setTimeout(r, 600));
    router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RECOMMENDATION);
  }, [router, setPhaseState]);

  // ── 3-2-1 countdown, then auto-capture ───────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (phaseRef.current === "captured") return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    let n = COUNTDOWN_FROM;
    setCount(n);
    setPhaseState("countdown");

    countdownRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        captureFrame();
      } else {
        setCount(n);
      }
    }, 1000);
  }, [captureFrame, setPhaseState]);

  // ── Camera setup (plain getUserMedia — no MediaPipe) ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: "user",
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        if (!cancelled) startCountdown();
      } catch {
        if (!cancelled)
          setErrorMsg("Camera unavailable — please check permissions.");
      }
    }

    start();

    const videoEl = videoRef.current;
    return () => {
      cancelled = true;
      if (countdownRef.current) clearInterval(countdownRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoEl) videoEl.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const caption = errorMsg
    ? errorMsg
    : phase === "starting"
      ? "Starting camera…"
      : phase === "captured"
        ? "Processing…"
        : "Get ready — look at the camera";

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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full"
              style={{
                objectFit: "cover",
                objectPosition: "center top",
                transform: "scaleX(-1)",
              }}
            />

            {/* Countdown number */}
            <AnimatePresence mode="wait">
              {phase === "countdown" && (
                <motion.div
                  key={count}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0, scale: 1.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span
                    style={{
                      fontSize: "5rem",
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.95)",
                      textShadow: "0 4px 30px rgba(0,0,0,0.7)",
                    }}
                  >
                    {count}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* White flash on capture */}
            <AnimatePresence>
              {phase === "captured" && (
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
                  color: errorMsg
                    ? "rgba(248,113,113,0.95)"
                    : "rgba(255,255,255,0.8)",
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

      {/* Capture controls */}
      {phase !== "captured" && !errorMsg && (
        <div className="shrink-0 pb-6 flex flex-col items-center gap-2">
          <button
            onClick={captureFrame}
            className="px-9 py-3 rounded-full font-semibold text-sm tracking-wide"
            style={{
              background: "rgba(72,199,142,0.18)",
              border: "1px solid rgba(72,199,142,0.55)",
              color: "rgba(72,199,142,0.95)",
              backdropFilter: "blur(8px)",
            }}
          >
            📸 Capture now
          </button>
          <button
            onClick={startCountdown}
            className="text-white/45 text-xs tracking-wide active:text-white/70 transition-colors"
          >
            Restart countdown
          </button>
        </div>
      )}

      {/* ChatWonder Chat overlay */}
      <ChatWonderChat mode="cosmetics" weather={weather} />
    </div>
  );
}
