"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState, useCallback } from "react";
import { FaRegHandPeace } from "react-icons/fa";


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
  } catch { /* labels unavailable — fall through to default */ }
  return { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" };
}

export default function KioskLoggedInPage() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username") || "User";
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const isCountingDownRef = useRef(false);
  const isSendingRef = useRef(false);
  const frameTimerRef = useRef<number | null>(null);

  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const [isFlashActive, setIsFlashActive] = useState(false);

  useEffect(() => { isCountingDownRef.current = isCountingDown; }, [isCountingDown]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setIsFlashActive(true);
    window.setTimeout(() => setIsFlashActive(false), 300);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    localStorage.setItem("mirror_captured_photo", dataUrl);

    window.setTimeout(() => router.push("/capture-picture"), 400);
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
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
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

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
        if (isCountingDownRef.current) return;
        const hand = results.multiHandLandmarks?.[0];
        if (!hand) return;

        const isIndexUp  = hand[8].y  < hand[6].y;
        const isMiddleUp = hand[12].y < hand[10].y;
        const isRingDown = hand[16].y > hand[14].y;
        const isPinkyDown = hand[20].y > hand[18].y;

        if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown) {
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
    <main className="min-h-screen bg-gradient-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca] text-text-primary flex flex-col items-center justify-center px-6 gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key="logged-in"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center text-center gap-6 w-full"
        >
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-4"
          >
            <h1 className="text-6xl font-bold bg-gradient-to-r from-[#6b5b95] via-[#8b7fc7] to-[#6b5b95] bg-clip-text text-transparent pb-3">
              Strike a Pose!
            </h1>
            <p className="flex items-center justify-center gap-3 text-2xl text-[#6b5b95]">
              <span>Show</span>
              <FaRegHandPeace className="text-4xl text-purple-500" />
              <span>to snap your photo!</span>
            </p>
          </motion.div>

          {/* Camera feed with countdown overlay */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className={`relative w-full rounded-2xl overflow-hidden border border-white/30 shadow-2xl transition-opacity duration-200 ${isFlashActive ? "opacity-20" : "opacity-100"}`}
            style={{ height: "80vh" }}
          >
            {isCountingDown && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={countdownValue}
                    initial={{ scale: 1.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-[200px] font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.95)] leading-none"
                  >
                    {countdownValue}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-feed -scale-x-100"
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
