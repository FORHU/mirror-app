"use client";

import { motion } from "motion/react";

/**
 * Abstract face-scan visualization — a stylized face outline + landmark mesh on
 * a dark panel. Deliberately shows NO real camera frame (privacy + clean look);
 * the actual photo is captured silently off-screen for analysis only.
 *
 * - mode "scanning": a sweep line travels down the face while the mesh pulses.
 * - mode "analyzed": static mesh with a soft confirm glow (used on the results
 *   screen in place of the captured selfie).
 *
 * Fills its positioned parent (parent should be `position: relative`).
 */

// Landmark points roughly tracing brows, eyes, nose, mouth and jaw on a
// 100×130 viewBox. Tuned to read as a face, not anatomically exact.
const POINTS: Array<[number, number]> = [
  // jaw / face outline
  [50, 8],
  [30, 14],
  [18, 30],
  [13, 52],
  [16, 74],
  [27, 95],
  [42, 110],
  [50, 116],
  [58, 110],
  [73, 95],
  [84, 74],
  [87, 52],
  [82, 30],
  [70, 14],
  // brows
  [33, 40],
  [42, 36],
  [50, 37],
  [58, 36],
  [67, 40],
  // eyes
  [36, 49],
  [44, 47],
  [56, 47],
  [64, 49],
  // nose
  [50, 50],
  [50, 62],
  [44, 70],
  [50, 72],
  [56, 70],
  // mouth
  [40, 84],
  [50, 82],
  [60, 84],
  [50, 90],
];

// Connections between landmark indices to form the mesh.
const LINKS: Array<[number, number]> = [
  // outline loop
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [13, 0],
  // brows
  [14, 15],
  [15, 16],
  [16, 17],
  [17, 18],
  // eyes
  [19, 20],
  [21, 22],
  // nose bridge + base
  [16, 23],
  [23, 24],
  [24, 25],
  [25, 26],
  [26, 27],
  [27, 24],
  // mouth
  [28, 29],
  [29, 30],
  [28, 31],
  [30, 31],
  // a few cross-mesh lines for the "wireframe" feel
  [14, 19],
  [18, 22],
  [19, 23],
  [22, 23],
  [25, 28],
  [27, 30],
  [1, 14],
  [13, 18],
];

export default function FaceScanGraphic({
  mode = "scanning",
  accent = "#48C78E",
  caption,
}: {
  mode?: "scanning" | "analyzed";
  accent?: string;
  caption?: string;
}) {
  const scanning = mode === "scanning";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(120% 90% at 50% 30%, rgba(72,199,142,0.06) 0%, rgba(0,0,0,0) 60%), #07090b",
        overflow: "hidden",
      }}
    >
      {/* Soft grid backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(70% 70% at 50% 45%, black 0%, transparent 80%)",
        }}
      />

      <svg
        viewBox="0 0 100 130"
        style={{ width: "62%", height: "62%", overflow: "visible" }}
        fill="none"
      >
        <defs>
          <clipPath id="faceClip">
            {/* approximate face oval to clip the scan sweep */}
            <ellipse cx="50" cy="62" rx="40" ry="56" />
          </clipPath>
        </defs>

        {/* Mesh links */}
        {LINKS.map(([a, b], i) => (
          <motion.line
            key={`l-${i}`}
            x1={POINTS[a][0]}
            y1={POINTS[a][1]}
            x2={POINTS[b][0]}
            y2={POINTS[b][1]}
            stroke={accent}
            strokeWidth={0.5}
            strokeOpacity={0.5}
            initial={false}
            animate={
              scanning
                ? { strokeOpacity: [0.25, 0.7, 0.25] }
                : { strokeOpacity: 0.55 }
            }
            transition={
              scanning
                ? { duration: 2.4, repeat: Infinity, delay: (i % 8) * 0.12 }
                : { duration: 0.4 }
            }
          />
        ))}

        {/* Landmark dots */}
        {POINTS.map(([x, y], i) => (
          <motion.circle
            key={`p-${i}`}
            cx={x}
            cy={y}
            r={1.1}
            fill={accent}
            initial={false}
            animate={
              scanning
                ? { opacity: [0.4, 1, 0.4], r: [1, 1.5, 1] }
                : { opacity: 0.9, r: 1.2 }
            }
            transition={
              scanning
                ? { duration: 1.8, repeat: Infinity, delay: (i % 6) * 0.15 }
                : { duration: 0.4 }
            }
          />
        ))}

        {/* Scan sweep line (clipped to the face) */}
        {scanning && (
          <g clipPath="url(#faceClip)">
            <motion.rect
              x={6}
              width={88}
              height={3}
              fill={accent}
              initial={{ y: 6, opacity: 0.9 }}
              animate={{ y: [6, 118, 6] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
            />
          </g>
        )}

        {/* Analyzed confirm ring */}
        {!scanning && (
          <motion.ellipse
            cx="50"
            cy="62"
            rx="42"
            ry="58"
            stroke={accent}
            strokeWidth={0.8}
            strokeOpacity={0.5}
            initial={{ strokeOpacity: 0 }}
            animate={{ strokeOpacity: [0, 0.6, 0.35] }}
            transition={{ duration: 1.2 }}
          />
        )}
      </svg>

      {/* Corner framing brackets for the "scanner" feel */}
      {["tl", "tr", "bl", "br"].map((c) => (
        <span
          key={c}
          style={{
            position: "absolute",
            width: 22,
            height: 22,
            borderColor: "rgba(72,199,142,0.6)",
            borderStyle: "solid",
            borderWidth: 0,
            ...(c[0] === "t"
              ? { top: 12, borderTopWidth: 2 }
              : { bottom: 12, borderBottomWidth: 2 }),
            ...(c[1] === "l"
              ? { left: 12, borderLeftWidth: 2 }
              : { right: 12, borderRightWidth: 2 }),
          }}
        />
      ))}

      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "18px 10px 8px",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
            {caption}
          </span>
        </div>
      )}
    </div>
  );
}
