"use client";

import QRCode from "react-qr-code";
import { motion, AnimatePresence } from "motion/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { useKioskSocket } from "@/modules/shared/socket/useKioskSocket";
import { type MirrorKey } from "@/modules/shared/constants/mirrors";

interface QrCodeViewProps {
  mirrorKey: MirrorKey;
}

const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

type Corner = "tl" | "tr" | "bl" | "br";

function CornerBracket({ corner }: { corner: Corner }) {
  const size = 22;
  const thickness = 3;
  const color = "#7c6ff7";

  const posStyle: React.CSSProperties =
    corner === "tl" ? { top: 0, left: 0 } :
    corner === "tr" ? { top: 0, right: 0 } :
    corner === "bl" ? { bottom: 0, left: 0 } :
                      { bottom: 0, right: 0 };

  const borderStyle: React.CSSProperties =
    corner === "tl" ? { borderTop: `${thickness}px solid ${color}`, borderLeft:  `${thickness}px solid ${color}`, borderRadius: "4px 0 0 0" } :
    corner === "tr" ? { borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}`, borderRadius: "0 4px 0 0" } :
    corner === "bl" ? { borderBottom: `${thickness}px solid ${color}`, borderLeft:  `${thickness}px solid ${color}`, borderRadius: "0 0 0 4px" } :
                      { borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}`, borderRadius: "0 0 4px 0" };

  return (
    <motion.div
      className="absolute"
      style={{ ...posStyle, width: size, height: size, ...borderStyle }}
      animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.06, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function QrFrame({ value }: { value: string }) {
  const pad = 28;

  return (
    <div className="relative" style={{ display: "inline-block" }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: pad,
          boxShadow: "0 24px 64px rgba(124,111,247,0.25), 0 4px 16px rgba(0,0,0,0.4)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <QRCode value={value} size={220} />
        <motion.div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            height: 2,
            background: "linear-gradient(90deg, transparent 0%, #7c6ff7 50%, transparent 100%)",
            borderRadius: 1,
          }}
          initial={{ top: pad }}
          animate={{ top: [pad, 220 + pad - 2, pad] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      </div>
      {(["tl", "tr", "bl", "br"] as Corner[]).map((c) => (
        <CornerBracket key={c} corner={c} />
      ))}
    </div>
  );
}

export function QrCodeView({ mirrorKey }: QrCodeViewProps) {
  const { kioskId, kioskName, waitingForLogin, isLoggedIn, loggedInUsername } =
    useKioskSocket(mirrorKey);
  const router = useRouter();

  useEffect(() => {
    if (!BYPASS_AUTH && waitingForLogin) router.push("/waiting-login");
  }, [waitingForLogin, router]);

  useEffect(() => {
    if (!BYPASS_AUTH && isLoggedIn)
      router.push(`/event-setup?username=${encodeURIComponent(loggedInUsername || "User")}`);
  }, [isLoggedIn, loggedInUsername, router]);

  const qrValue = `${process.env.NEXT_PUBLIC_SITE_URL}/${kioskId}?kioskName=${kioskName}`;

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden bg-[#0c0b18]">
      <AnimatedBackground />

      {/* ── Header ── */}
      <header
        className="mirror-header relative z-10 flex items-center justify-between shrink-0"
        style={{ paddingLeft: 44, paddingRight: 44 }}
      >
        {/* ● SMART MIRROR badge */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#1e1c35",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "8px 18px",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10d49a", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f0eeff" }}>
            Smart Mirror
          </span>
        </motion.div>

        <motion.span
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "#8a87b0",
            background: "#1e1c35",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            padding: "6px 16px",
          }}
        >
          {kioskName}
        </motion.span>
      </header>

      {/* ── Main ── */}
      <main className="mirror-main relative z-10 flex flex-col items-center justify-center shrink-0 gap-10">
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
            <div
              className="flex flex-col items-center"
              style={{
                padding: "28px 44px 24px",
                background: "rgba(20,18,48,0.75)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 24,
              }}
            >
              <span style={{ fontSize: 72, fontWeight: 800, color: "#f0eeff", display: "block", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                Scan to begin
              </span>
              <span
                style={{
                  fontSize: 72,
                  fontWeight: 800,
                  fontStyle: "italic",
                  display: "block",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  paddingBottom: "0.2em",
                  background: "linear-gradient(135deg, #7c6ff7 0%, #a78bfa 50%, #10d49a 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                your session.
              </span>
            </div>

            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <QrFrame value={qrValue} />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              style={{ fontSize: 20, color: "#8a87b0", fontWeight: 500, letterSpacing: "0.01em" }}
            >
              Point your camera at the code above
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer
        className="mirror-footer relative z-10 flex items-center justify-center shrink-0"
        style={{ paddingLeft: 44, paddingRight: 44 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="flex items-center gap-5"
          style={{ fontSize: 16, color: "#8a87b0", fontWeight: 500, letterSpacing: "0.03em" }}
        >
          <span style={{ color: "#7c6ff7", fontWeight: 700 }}>① Scan</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>② Set up</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>③ Start styling</span>
        </motion.div>
      </footer>
    </div>
  );
}
