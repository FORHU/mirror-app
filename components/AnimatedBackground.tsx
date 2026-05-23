"use client";

import { motion } from "motion/react";

interface AnimatedBackgroundProps {
  className?: string;
}

const BLOBS = [
  {
    style: {
      width: 700,
      height: 700,
      background: "rgba(167,139,250,0.70)",
      filter: "blur(60px)",
      top: -200,
      left: -180,
    },
    animate: {
      x: [0, 140, 60, 180, 0],
      y: [0, 100, 220, 70, 0],
      scale: [1, 1.15, 0.9, 1.1, 1],
    },
    duration: 12,
  },
  {
    style: {
      width: 620,
      height: 620,
      background: "rgba(251,113,133,0.65)",
      filter: "blur(55px)",
      bottom: -180,
      right: -150,
    },
    animate: {
      x: [0, -120, -180, -60, 0],
      y: [0, -130, -60, -160, 0],
      scale: [1, 0.88, 1.2, 0.95, 1],
    },
    duration: 10,
  },
  {
    style: {
      width: 550,
      height: 550,
      background: "rgba(196,181,253,0.65)",
      filter: "blur(50px)",
      top: "35%",
      right: -140,
    },
    animate: {
      x: [0, -160, -60, -140, 0],
      y: [0, 120, -80, 60, 0],
      scale: [1, 1.12, 0.92, 1.08, 1],
    },
    duration: 14,
  },
  {
    style: {
      width: 500,
      height: 500,
      background: "rgba(255,160,122,0.58)",
      filter: "blur(65px)",
      top: "45%",
      left: -120,
    },
    animate: {
      x: [0, 160, 80, 130, 0],
      y: [0, -100, 140, -50, 0],
      scale: [0.9, 1.2, 0.95, 1.1, 0.9],
    },
    duration: 11,
  },
  {
    style: {
      width: 460,
      height: 460,
      background: "rgba(240,171,252,0.62)",
      filter: "blur(58px)",
      bottom: "15%",
      left: "22%",
    },
    animate: {
      x: [0, 90, -60, 110, 0],
      y: [0, -140, 80, -90, 0],
      scale: [1, 0.92, 1.18, 0.97, 1],
    },
    duration: 13,
  },
];

export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div
      className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${className ?? ""}`}
    >
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={blob.style}
          animate={blob.animate}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
