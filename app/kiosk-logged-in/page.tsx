"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { tryOnModelService } from "@/modules/shared/api/try-on.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type HandLandmark = { x: number; y: number; z: number };
type Results = { multiHandLandmarks?: HandLandmark[][] };
type HandsInstance = {
  setOptions: (opts: {
    maxNumHands: number;
    modelComplexity: 0 | 1;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (cb: (results: Results) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
};

declare global {
  interface Window {
    Hands: new (config: { locateFile: (file: string) => string }) => HandsInstance;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HANDS_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.body.appendChild(s);
  });
}

async function resolveEmeetCamera(): Promise<MediaStreamConstraints["video"]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === "videoinput");
    const wide = cameras.find(d => /emeet|pixy/i.test(d.label));
    if (wide?.deviceId) {
      return { deviceId: { exact: wide.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    }
  } catch { /* labels unavailable */ }
  return { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" };
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KioskLoggedInPage() {
  const router = useRouter();

  const videoRef          = useRef<HTMLVideoElement | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const isCountingDownRef = useRef(false);
  const isSendingRef      = useRef(false);
  const frameTimerRef     = useRef<number | null>(null);

  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const [isFlashActive, setIsFlashActive]   = useState(false);
  const [previewUrl,    setPreviewUrl]      = useState<string | null>(null);

  useEffect(() => { isCountingDownRef.current = isCountingDown; }, [isCountingDown]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setIsFlashActive(true);
    window.setTimeout(() => setIsFlashActive(false), 350);

    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    setIsCountingDown(false);
    isCountingDownRef.current = false;
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.92));
  }, []);

  const confirmPhoto = useCallback(() => {
    if (!previewUrl) return;
    localStorage.setItem("mirror_captured_photo", previewUrl);
    tryOnModelService.uploadModel(previewUrl).catch(() => {});
    router.push("/outfit-builder");
  }, [previewUrl, router]);

  const retakePhoto = useCallback(() => {
    setPreviewUrl(null);
    setIsCountingDown(false);
    isCountingDownRef.current = false;
    setCountdownValue(3);
  }, []);

  const startCountdown = useCallback(() => {
    if (isCountingDownRef.current) return;
    setIsCountingDown(true);
    isCountingDownRef.current = true;
    setCountdownValue(3);

    let count = 3;
    countdownTimerRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) { setCountdownValue(count); return; }
      window.clearInterval(countdownTimerRef.current!);
      countdownTimerRef.current = null;
      takePhoto();
    }, 1000);
  }, [takePhoto]);

  useEffect(() => {
    let active = true;

    async function init() {
      const videoConstraints = await resolveEmeetCamera();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch { return; }

      if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      await loadScript(HANDS_CDN);
      if (!active || !window.Hands) return;

      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
      hands.onResults((results) => {
        if (isCountingDownRef.current) return;
        const hand = results.multiHandLandmarks?.[0];
        if (!hand) return;
        if (hand[8].y < hand[6].y && hand[12].y < hand[10].y && hand[16].y > hand[14].y && hand[20].y > hand[18].y) {
          startCountdown();
        }
      });

      function scheduleFrame() {
        if (!active) return;
        const video = videoRef.current;
        if (!isSendingRef.current && video && video.readyState >= 2) {
          isSendingRef.current = true;
          hands.send({ image: video }).finally(() => { isSendingRef.current = false; });
        }
        frameTimerRef.current = window.setTimeout(scheduleFrame, 100);
      }
      scheduleFrame();
    }

    init().catch(() => {});

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      if (frameTimerRef.current) window.clearTimeout(frameTimerRef.current);
    };
  }, [startCountdown]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">

      {/* ── Camera — full bleed ── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover -scale-x-100"
      />

      {/* ── Flash ── */}
      <AnimatePresence>
        {isFlashActive && (
          <motion.div
            key="flash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-50 bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>


      {/* ── Countdown ── */}
      <AnimatePresence>
        {isCountingDown && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.span
                key={countdownValue}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.55, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="font-black text-white select-none leading-none"
                style={{
                  fontSize: "220px",
                  textShadow: "0 0 40px rgba(255,255,255,1), 0 0 90px rgba(192,132,252,0.85)",
                }}
              >
                {countdownValue}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header
        className="absolute top-0 inset-x-0 z-20"
        style={{
          height: "var(--zone-header)",
          background: "linear-gradient(180deg, rgba(30,14,60,0.85) 0%, transparent 100%)",
        }}
      />

      {/* ── Footer ── */}
      <footer
        className="absolute bottom-0 inset-x-0 z-20 flex flex-col items-center justify-end pb-10 gap-4"
        style={{
          height: "var(--zone-footer)",
          background: "linear-gradient(0deg, rgba(30,14,60,0.92) 0%, rgba(30,14,60,0.45) 60%, transparent 100%)",
        }}
      >
        <div className="flex items-center gap-5">
          <motion.span
            className="text-8xl leading-none"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            ✌️
          </motion.span>
          <span className="text-white font-bold text-6xl tracking-tight">Strike a Pose!</span>
        </div>
        <p className="text-white/50 text-3xl">Show a peace sign to snap your photo</p>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/outfit-builder")}
          className="mt-1 border border-white/20 bg-white/10 rounded-full px-14 py-5 text-white/80 font-semibold text-3xl tracking-wide backdrop-blur-sm"
        >
          Build Outfit
        </motion.button>
      </footer>

      {/* ── Photo confirmation modal ── */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            key="photo-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{ background: "rgba(10,4,24,0.82)", backdropFilter: "blur(12px)" }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 32 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex flex-col items-center"
              style={{ width: 560 }}
            >
              {/* Photo preview */}
              <div
                className="w-full overflow-hidden"
                style={{
                  borderRadius: "28px",
                  border: "1.5px solid rgba(255,255,255,0.14)",
                  boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
                  marginBottom: 32,
                  aspectRatio: "3/4",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Captured photo preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Label */}
              <p
                className="font-semibold text-white text-center"
                style={{ fontSize: "34px", marginBottom: 10, letterSpacing: "-0.01em" }}
              >
                Use this photo?
              </p>
              <p
                className="text-center"
                style={{ fontSize: "22px", color: "rgba(255,255,255,0.45)", marginBottom: 36 }}
              >
                Looks good, or strike a new pose
              </p>

              {/* Actions */}
              <div className="flex gap-4 w-full">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={retakePhoto}
                  className="flex-1 font-semibold text-white/80"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1.5px solid rgba(255,255,255,0.14)",
                    borderRadius: "18px",
                    padding: "22px 0",
                    fontSize: "26px",
                  }}
                >
                  Retake
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmPhoto}
                  className="flex-1 font-semibold text-white"
                  style={{
                    background: "linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)",
                    boxShadow: "0 16px 48px rgba(167,139,250,0.35)",
                    borderRadius: "18px",
                    padding: "22px 0",
                    fontSize: "26px",
                  }}
                >
                  Use Photo →
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
