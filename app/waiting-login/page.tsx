"use client";

import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

export default function WaitingLoginPage() {
  const { isLoggedIn, loggedInUsername } = useKioskSocket();
  const router = useRouter();

  useEffect(() => {
    if (!BYPASS_AUTH && isLoggedIn) {
      router.push("/kiosk-logged-in");
    }
  }, [isLoggedIn, loggedInUsername, router]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0c0b18] flex items-center justify-center">
      <AnimatedBackground />

      <AnimatePresence mode="wait">
        <motion.div
          key="waiting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative z-10 flex flex-col items-center text-center gap-10 px-12"
        >
          {/* ● SMART MIRROR badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#1e1c35",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999,
              padding: "8px 18px",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10d49a" }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#f0eeff" }}>
              Smart Mirror
            </span>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h1 style={{ fontSize: 72, fontWeight: 800, color: "#f0eeff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Waiting to{" "}
              <span style={{
                fontStyle: "italic",
                background: "linear-gradient(135deg, #7c6ff7 0%, #a78bfa 50%, #10d49a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                Connect
              </span>
            </h1>
            <p style={{ fontSize: 24, color: "#8a87b0", maxWidth: 520, lineHeight: 1.5 }}>
              Your mirror has been scanned. Please complete the setup on the other device.
            </p>
          </motion.div>

          {/* Animated dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-3"
          >
            {[0, 0.2, 0.4].map((delay, i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay }}
                style={{ width: 14, height: 14, borderRadius: "50%", background: "linear-gradient(135deg, #7c6ff7, #10d49a)" }}
              />
            ))}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
