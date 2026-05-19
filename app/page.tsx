"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { AnimatedBackground } from "@/components/AnimatedBackground";

const TAGLINES = [
  { line1: "The mirror",    line2: "has opinions."  },
  { line1: "Dressed for",   line2: "the moment."    },
  { line1: "Every outfit,", line2: "considered."    },
  { line1: "Step out",      line2: "with intent."   },
  { line1: "Wear the",      line2: "right thing."   },
];

export default function WelcomePage() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
      setDate(now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % TAGLINES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden bg-[#f0e6ff]">
      <AnimatedBackground />

      {/* ── Header zone ─────────────────────────────────────────────────────── */}
      <header
        className="mirror-header relative z-10 flex items-center justify-between shrink-0"
        style={{ paddingLeft: 44, paddingRight: 44 }}
      >
        <motion.span
          style={{ fontSize: 15, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6b5b95" }}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          StyleOS
        </motion.span>

        <motion.div
          className="text-right"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p style={{ fontSize: 26, fontWeight: 600, color: "#3d2f5f", lineHeight: 1.1 }}>{time}</p>
          <p style={{ fontSize: 13, color: "#9e93c8", letterSpacing: "0.03em", marginTop: 3 }}>{date}</p>
        </motion.div>
      </header>

      {/* ── Main zone — cycling taglines ─────────────────────────────────── */}
      <main className="mirror-main relative z-10 flex items-center justify-center shrink-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            className="flex flex-col items-center"
            style={{ paddingLeft: 44, paddingRight: 44 }}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <span style={{ fontSize: 96, fontWeight: 800, color: "#3d2f5f", display: "block", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              {TAGLINES[activeIndex].line1}
            </span>
            <span
              style={{
                fontSize: 96,
                fontWeight: 800,
                display: "block",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                paddingBottom: "0.2em",
                background: "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 45%, #fb7185 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {TAGLINES[activeIndex].line2}
            </span>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer zone — CTA ────────────────────────────────────────────── */}
      <footer
        className="mirror-footer relative z-10 flex flex-col items-center gap-3 shrink-0"
        style={{ paddingLeft: 44, paddingRight: 44 }}
      >
        <motion.button
          className="w-full font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #fb7185 100%)",
            borderRadius: 20,
            padding: "26px 0",
            fontSize: 26,
            boxShadow: "0 8px 48px rgba(124,58,237,0.40)",
            border: "none",
            cursor: "pointer",
          }}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/qrcode/mirror-a")}
        >
          Start Now
        </motion.button>

        {process.env.NODE_ENV === "development" && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/mirror/dev/token`);
                const { token } = await res.json();
                if (token) {
                  localStorage.setItem("token", token);
                  router.push("/map");
                }
              } catch {
                alert("Dev bypass failed. Make sure mirror-api is running and seeded.");
              }
            }}
            className="w-full font-semibold"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1.5px solid rgba(255,255,255,0.14)",
              borderRadius: 16,
              padding: "16px 0",
              fontSize: 18,
              color: "rgba(107,91,149,0.6)",
              cursor: "pointer",
            }}
          >
            Dev: Skip to Map
          </motion.button>
        )}
      </footer>
    </div>
  );
}
