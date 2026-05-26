"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/navigation";

// ── Oval dimensions (768 × 1366 portrait kiosk) ──────────────────────────────
const OX = 384;
const OY = 580;
const RX = 330; // 660 px wide  (86 % of screen)
const RY = 410; // 820 px tall

const FACE_MESH_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
const CAMERA_UTILS_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
const ALIGN_THRESHOLD = 20; // consecutive frames before triggering hold
const HOLD_MS = 1500; // ms to hold before capture fires

// ── Types ─────────────────────────────────────────────────────────────────────
type FaceLandmark = { x: number; y: number; z: number };
type FaceMeshResults = { multiFaceLandmarks?: FaceLandmark[][] };
type FaceMeshInstance = {
  setOptions: (opts: {
    maxNumFaces: number;
    refineLandmarks: boolean;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (cb: (r: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
};
type CameraInstance = { start: () => void; stop?: () => void };
type CapturePhase = "idle" | "holding" | "captured" | "analyzing";

declare global {
  interface Window {
    FaceMesh: new (config: {
      locateFile: (file: string) => string;
    }) => FaceMeshInstance;
    Camera: new (
      video: HTMLVideoElement,
      config: { onFrame: () => Promise<void>; width: number; height: number },
    ) => CameraInstance;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.body.appendChild(s);
  });
}

// Converts MediaPipe normalised (0–1) coords → display pixels.
// Accounts for object-cover scaling and the scaleX(-1) mirror flip.
function toDisplayCoords(lm: FaceLandmark, video: HTMLVideoElement) {
  const videoAspect = video.videoWidth / video.videoHeight;
  const contAspect = video.clientWidth / video.clientHeight;
  let scaledW: number, scaledH: number, offsetX: number, offsetY: number;
  if (videoAspect > contAspect) {
    scaledH = video.clientHeight;
    scaledW = scaledH * videoAspect;
    offsetX = (scaledW - video.clientWidth) / 2;
    offsetY = 0;
  } else {
    scaledW = video.clientWidth;
    scaledH = scaledW / videoAspect;
    offsetX = 0;
    offsetY = (scaledH - video.clientHeight) / 2;
  }
  const px = lm.x * scaledW - offsetX;
  const py = lm.y * scaledH - offsetY;
  return { x: video.clientWidth - px, y: py }; // apply mirror flip
}

function inOval(p: { x: number; y: number }) {
  return ((p.x - OX) / RX) ** 2 + ((p.y - OY) / RY) ** 2 <= 1;
}

const CHECK_LM = [4, 152, 10, 234, 454, 1]; // nose-tip, chin, forehead, jaw L/R, nose bridge

// ── Mock analysis generator ───────────────────────────────────────────────────
const SKIN_TYPES = [
  "OILY",
  "DRY",
  "COMBINATION",
  "NORMAL",
  "SENSITIVE",
] as const;
const SKIN_TONES = [
  "warm light",
  "cool light",
  "neutral light",
  "warm medium",
  "cool medium",
  "neutral medium",
  "warm deep",
  "cool deep",
  "neutral deep",
] as const;
const CONCERN_POOL = [
  "enlarged pores",
  "acne",
  "dark circles",
  "uneven skin tone",
  "fine lines",
  "oiliness",
  "dryness",
  "redness",
  "hyperpigmentation",
];
const TIPS = [
  "Use a gentle foaming cleanser morning and evening to control oil without stripping moisture.",
  "Apply a hydrating serum with hyaluronic acid before moisturizer to lock in hydration.",
  "Wear SPF 30+ daily — UV exposure worsens uneven tone and accelerates fine lines.",
  "Incorporate a niacinamide serum to reduce pore appearance and even out skin tone.",
];

function rand(n: number) {
  return Math.floor(Math.random() * n);
}
function randInt(min: number, max: number) {
  return min + rand(max - min);
}

function buildMockAnalysis() {
  const concerns = [...CONCERN_POOL]
    .sort(() => Math.random() - 0.5)
    .slice(0, randInt(2, 5));
  return {
    id: "mock",
    skinType: SKIN_TYPES[rand(SKIN_TYPES.length)],
    skinTone: SKIN_TONES[rand(SKIN_TONES.length)],
    hydrationPct: randInt(20, 85),
    oilinessPct: randInt(15, 80),
    concerns,
    routineTip: TIPS[rand(TIPS.length)],
    recommendations: [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CosmeticPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraInstance | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alignedFrames = useRef(0);
  const faceAlignedRef = useRef(false);
  const capturePhaseRef = useRef<CapturePhase>("idle");
  const latestLandmarksRef = useRef<FaceLandmark[] | null>(null);

  const [isModelLoading, setIsModelLoading] = useState(true);
  const [faceAligned, setFaceAligned] = useState(false);
  const [capturePhase, setCapturePhase] = useState<CapturePhase>("idle");

  const setFaceAlignedState = useCallback((nextFaceAligned: boolean) => {
    faceAlignedRef.current = nextFaceAligned;
    setFaceAligned(nextFaceAligned);
  }, []);

  const setCapturePhaseState = useCallback((nextCapturePhase: CapturePhase) => {
    capturePhaseRef.current = nextCapturePhase;
    setCapturePhase(nextCapturePhase);
  }, []);

  // ── Capture frame ────────────────────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    try {
      sessionStorage.setItem("skin_capture", dataUrl);
    } catch {}
    if (latestLandmarksRef.current) {
      try {
        sessionStorage.setItem(
          "skin_landmarks",
          JSON.stringify(latestLandmarksRef.current),
        );
      } catch {}
    }

    setCapturePhaseState("captured"); // triggers white flash

    // Let the flash animation play before showing analyzing state
    await new Promise((r) => setTimeout(r, 600));
    setCapturePhaseState("analyzing");

    // Brief fake delay so "Analyzing…" state is visible
    await new Promise((r) => setTimeout(r, 800));
    try {
      const analysis = buildMockAnalysis();
      sessionStorage.setItem("skin_analysis", JSON.stringify(analysis));
    } catch {}
    router.push(ROUTES.AI_RECOMMENDATION_COSMETIC_RESULT);
  }, [router, setCapturePhaseState]);

  // ── Face-aligned → hold → capture trigger ───────────────────────────────────
  const beginCaptureHold = useCallback(() => {
    if (capturePhaseRef.current !== "idle") return;
    setCapturePhaseState("holding");
    holdTimerRef.current = setTimeout(captureFrame, HOLD_MS);
  }, [captureFrame, setCapturePhaseState]);

  const cancelCaptureHold = useCallback(() => {
    if (capturePhaseRef.current !== "holding") return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setCapturePhaseState("idle");
  }, [setCapturePhaseState]);

  // ── FaceMesh results handler ─────────────────────────────────────────────────
  const handleResults = useCallback(
    (results: FaceMeshResults) => {
      if (capturePhaseRef.current !== "idle") return; // freeze detection once holding/captured/analyzing

      const landmarks = results.multiFaceLandmarks?.[0];
      const video = videoRef.current;
      if (!video) return;

      if (landmarks) latestLandmarksRef.current = landmarks;

      if (!landmarks) {
        alignedFrames.current = 0;
        if (faceAlignedRef.current) {
          setFaceAlignedState(false);
          cancelCaptureHold();
        }
        return;
      }

      const allIn = CHECK_LM.every((i) =>
        inOval(toDisplayCoords(landmarks[i], video)),
      );

      if (allIn) {
        alignedFrames.current += 1;
        if (
          alignedFrames.current >= ALIGN_THRESHOLD &&
          !faceAlignedRef.current
        ) {
          setFaceAlignedState(true);
          beginCaptureHold();
        }
      } else {
        alignedFrames.current = 0;
        if (faceAlignedRef.current) {
          setFaceAlignedState(false);
          cancelCaptureHold();
        }
      }
    },
    [beginCaptureHold, cancelCaptureHold, setFaceAlignedState],
  );

  // ── MediaPipe init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function init() {
      await Promise.all([
        loadScript(FACE_MESH_CDN),
        loadScript(CAMERA_UTILS_CDN),
      ]);
      if (!isMounted || !videoRef.current || !window.FaceMesh || !window.Camera)
        return;

      const faceMesh = new window.FaceMesh({
        locateFile: (f) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      faceMesh.onResults(handleResults);

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (!videoRef.current) return;
          await faceMesh.send({ image: videoRef.current });
        },
        width: 1920,
        height: 1080,
      });
      camera.start();
      cameraRef.current = camera;
      if (isMounted) setIsModelLoading(false);
    }

    init().catch(() => {
      if (isMounted) setIsModelLoading(false);
    });

    return () => {
      isMounted = false;
      cameraRef.current?.stop?.();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [handleResults]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const ovalColor =
    faceAligned || capturePhase !== "idle"
      ? "rgba(72,199,142,0.95)"
      : "rgba(255,255,255,0.85)";

  const instructionText = isModelLoading
    ? "Initializing camera…"
    : capturePhase === "analyzing"
      ? "Analyzing your skin…"
      : capturePhase === "captured"
        ? "Processing…"
        : capturePhase === "holding"
          ? "Hold still…"
          : faceAligned
            ? "Face detected"
            : "Position your face within the guide";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Camera feed — horizontally mirrored */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(1)" }}
      />

      {/* SVG: vignette + oval border */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 768 1366"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="face-oval-mask">
            <rect width="768" height="1366" fill="white" />
            <ellipse cx={OX} cy={OY} rx={RX} ry={RY} fill="black" />
          </mask>
          <filter id="oval-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          width="768"
          height="1366"
          fill="rgba(0,0,0,0.62)"
          mask="url(#face-oval-mask)"
        />

        <ellipse
          cx={OX}
          cy={OY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke={ovalColor}
          strokeWidth={capturePhase === "holding" ? 3.5 : 2.5}
          filter="url(#oval-glow)"
          style={{ transition: "stroke 0.4s ease, stroke-width 0.3s ease" }}
        />
      </svg>

      {/* Emerald pulse fill — during hold and during analysis */}
      <AnimatePresence>
        {(capturePhase === "holding" || capturePhase === "analyzing") && (
          <motion.div
            key="hold-pulse"
            className="absolute inset-0 pointer-events-none"
            style={{ clipPath: `ellipse(${RX}px ${RY}px at ${OX}px ${OY}px)` }}
            animate={{ opacity: [0, 0.12, 0] }}
            transition={{ duration: 0.75, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full bg-emerald-400" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* White flash on capture */}
      <AnimatePresence>
        {capturePhase === "captured" && (
          <motion.div
            key="capture-flash"
            className="absolute inset-0 bg-white pointer-events-none z-40"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        className="absolute top-0 inset-x-0 z-20 flex items-center px-8 pt-10 pb-4"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-white/80 active:text-white transition-colors"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
        <h1 className="flex-1 text-center text-white font-bold text-2xl pr-10">
          Skin Analysis
        </h1>
      </motion.div>

      {/* Instruction text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={instructionText}
          className="absolute inset-x-0 z-10 text-center text-lg tracking-wide"
          style={{
            top: `${((OY + RY + 36) / 1366) * 100}%`,
            color:
              capturePhase !== "idle" || faceAligned
                ? "rgba(72,199,142,0.95)"
                : "rgba(255,255,255,0.60)",
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
        >
          {instructionText}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
