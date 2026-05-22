"use client";

import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { type MirrorKey } from "@/modules/shared/constants/mirrors";
import WeatherWidget from "@/components/WeatherWidget";
import "../styles/glow.css";

interface QrCodeViewProps {
  mirrorKey: MirrorKey;
}

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

// ── QR frame ──────────────────────────────────────────────────────────────────

function QrFrame({ value }: { value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: 28,
        boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      <QRCode value={value} size={220} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QrCodeView({ mirrorKey }: QrCodeViewProps) {
  const { kioskId, kioskName, waitingForLogin, isLoggedIn, loggedInUsername } =
    useKioskSocket(mirrorKey);
  const router = useRouter();

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      );
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!BYPASS_AUTH && waitingForLogin) router.push("/waiting-login");
  }, [waitingForLogin, router]);

  useEffect(() => {
    if (!BYPASS_AUTH && isLoggedIn)
      router.push(
        `/event-setup?username=${encodeURIComponent(loggedInUsername || "User")}`,
      );
  }, [isLoggedIn, loggedInUsername, router]);

  const qrValue = `${process.env.NEXT_PUBLIC_SITE_URL}/${kioskId}?kioskName=${kioskName}`;

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden px-10 py-10">
      {/* Header — matches page.tsx layout */}
      <div className="flex items-center shrink-0 py-4 px-4 mb-6">
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <WeatherWidget iconSize={32} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
            width: "50%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <span className="text-white font-semibold text-3xl tracking-wide select-none">
            StyleOS
          </span>
        </div>
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <p className="text-white font-semibold text-2xl leading-tight">
            {time}
          </p>
          <p className="text-white/40 text-sm mt-0.5">{date}</p>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center gap-10 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key="qr-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-10"
          >
            {/* Headline */}
            <div className="flex flex-col items-center">
              <span
                className="text-white font-extrabold tracking-tight select-none"
                style={{ fontSize: 72, lineHeight: 1.05 }}
              >
                Scan to begin
              </span>
              <span
                className="text-white/30 font-extrabold tracking-tight select-none"
                style={{ fontSize: 72, lineHeight: 1.05 }}
              >
                your session.
              </span>
            </div>

            {/* QR frame */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.25,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <QrFrame value={qrValue} />
            </motion.div>

            {/* Instruction */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="text-white/40 font-medium"
              style={{ fontSize: 20, letterSpacing: "0.01em" }}
            >
              Point your camera at the code above
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
