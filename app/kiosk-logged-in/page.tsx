"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, useCallback } from "react";

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

    localStorage.setItem("mirror_captured_photo", canvas.toDataURL("image/jpeg", 0.92));
    window.setTimeout(() => router.push("/capture-picture"), 450);
  }, [router]);

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

    </main>
  );
}
