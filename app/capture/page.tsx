"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HandLandmark = { x: number; y: number; z: number };
type Results = { multiHandLandmarks?: HandLandmark[][] };

type HandsInstance = {
  setOptions: (options: {
    maxNumHands: number;
    modelComplexity: 0 | 1;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  onResults: (callback: (results: Results) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
};

type CameraInstance = { start: () => void; stop?: () => void };

declare global {
  interface Window {
    Hands: new (config: { locateFile: (file: string) => string }) => HandsInstance;
    Camera: new (
      video: HTMLVideoElement,
      config: { onFrame: () => Promise<void>; width: number; height: number },
    ) => CameraInstance;
  }
}

const HANDS_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
const CAMERA_UTILS_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

export default function CapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<CameraInstance | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const isCountingDownRef = useRef(false);

  const [statusText, setStatusText] = useState("Position your hand and show ✌️");
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    isCountingDownRef.current = isCountingDown;
  }, [isCountingDown]);

  const takePhoto = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) return;

    setIsFlashActive(true);
    window.setTimeout(() => setIsFlashActive(false), 200);

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, 0, 0);

    const imageData = canvas.toDataURL("image/png");
    setThumbnails((prev) => [imageData, ...prev]);
    setStatusText("PHOTO SAVED! Show ✌️ to take another.");

    cooldownTimerRef.current = window.setTimeout(() => {
      setIsCountingDown(false);
    }, 2000);
  }, []);

  const startCountdown = useCallback(() => {
    setIsCountingDown(true);
    setStatusText("GET READY!");
    setCountdownValue(5);

    let count = 5;
    countdownTimerRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownValue(count);
        return;
      }

      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      takePhoto();
    }, 1000);
  }, [takePhoto]);

  useEffect(() => {
    let isMounted = true;

    async function initializeCamera() {
      await Promise.all([loadScript(HANDS_CDN), loadScript(CAMERA_UTILS_CDN)]);
      if (!isMounted || !videoRef.current || !window.Hands || !window.Camera) return;

      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results) => {
        if (isCountingDownRef.current) return;

        const hand = results.multiHandLandmarks?.[0];
        if (!hand) return;

        const isIndexUp = hand[8].y < hand[6].y;
        const isMiddleUp = hand[12].y < hand[10].y;
        const isRingDown = hand[16].y > hand[14].y;
        const isPinkyDown = hand[20].y > hand[18].y;

        if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown) {
          startCountdown();
        }
      });

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (!videoRef.current) return;
          await hands.send({ image: videoRef.current });
        },
        width: 1920,
        height: 1080,
      });

      camera.start();
      cameraRef.current = camera;
      setIsReady(true);
    }

    initializeCamera().catch(() => {
      if (isMounted) {
        setStatusText("Unable to initialize webcam. Please allow camera access.");
      }
    });

    return () => {
      isMounted = false;
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      if (cooldownTimerRef.current) window.clearTimeout(cooldownTimerRef.current);
      cameraRef.current?.stop?.();
    };
  }, [startCountdown]);

  return (
    <main className="min-h-screen bg-[#121212] text-white px-6 py-8">
      <section className="mx-auto w-full max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-4">
          EMEET 4K Gesture Timer
        </h1>
        <div className="mx-auto w-fit rounded-full border border-[#444] bg-[#222] px-5 py-2 text-base md:text-lg">
          {statusText}
        </div>

        <div
          className={`relative mt-6 w-full overflow-hidden rounded-2xl border-4 border-[#333] shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
            isFlashActive ? "opacity-30" : "opacity-100"
          } transition-opacity duration-200`}
        >
          {!isReady && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-black/65">
              <p className="text-sm md:text-base text-white/90">Starting camera...</p>
            </div>
          )}

          {isCountingDown && (
            <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
              <span className="text-[110px] md:text-[150px] font-bold text-[#00ff00] [text-shadow:0_0_20px_rgba(0,255,0,0.8)]">
                {countdownValue}
              </span>
            </div>
          )}

          <video ref={videoRef} autoPlay playsInline className="block w-full -scale-x-100" />
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {thumbnails.map((src, idx) => (
            <img
              key={`${src.slice(0, 30)}-${idx}`}
              src={src}
              alt={`Captured ${idx + 1}`}
              className="w-[200px] rounded-[10px] border-2 border-[#00ff00] transition-transform duration-200 hover:scale-105"
            />
          ))}
        </div>
      </section>
    </main>
  );
}
