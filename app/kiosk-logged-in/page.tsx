"use client";

import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, Suspense } from "react";

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

function KioskLoggedInContent() {
  const searchParams = useSearchParams();
  const username = searchParams.get("username") || "User";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      const videoConstraints = await resolveEmeetCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { /* camera permission denied or unavailable */ }
    }

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <main className="min-h-dvh bg-linear-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca] text-text-primary flex flex-col items-center justify-center px-6 gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key="logged-in"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center text-center gap-6 w-full"
        >
          {/* Title */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-4"
          >
            <h1 className="text-6xl font-bold bg-linear-to-r from-[#6b5b95] via-[#8b7fc7] to-[#6b5b95] bg-clip-text text-transparent pb-3">
              Strike a Pose!
            </h1>
            <p className="text-2xl text-[#6b5b95]">
              Stand in the frame and let&apos;s capture your best look.
            </p>
          </motion.div>

          {/* Camera feed — Emeet Pixy wide-angle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full rounded-2xl overflow-hidden border border-white/30 shadow-2xl"
            style={{ height: "80vh" }}
          >
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

export default function KioskLoggedInPage() {
  return (
    <Suspense fallback={null}>
      <KioskLoggedInContent />
    </Suspense>
  );
}
