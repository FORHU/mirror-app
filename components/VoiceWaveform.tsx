"use client";

import { useEffect, useRef } from "react";

// Siri-style flowing rainbow waveform. Several coloured sine layers scroll and
// breathe; while `active` they swell to full amplitude, otherwise they relax
// to a near-flat line. Paths are mutated directly in a requestAnimationFrame
// loop (no React re-render per frame) for smooth 60fps motion.

type Layer = {
  color: string;
  amp: number; // peak amplitude in px when active
  freq: number; // number of waves across the width
  speed: number; // phase advance per frame (sign = direction)
  phase: number; // starting phase
  width: number; // stroke width
};

const LAYERS: Layer[] = [
  { color: "#22d3ee", amp: 0.42, freq: 1.4, speed: 0.05, phase: 0.0, width: 2.5 },
  { color: "#d946ef", amp: 0.52, freq: 1.1, speed: -0.041, phase: 1.3, width: 2.5 },
  { color: "#3b82f6", amp: 0.34, freq: 1.9, speed: 0.062, phase: 2.1, width: 2.0 },
  { color: "#ec4899", amp: 0.48, freq: 0.9, speed: 0.034, phase: 3.4, width: 2.0 },
  { color: "#a78bfa", amp: 0.30, freq: 2.3, speed: -0.055, phase: 0.7, width: 1.8 },
  { color: "#ffffff", amp: 0.22, freq: 2.7, speed: 0.072, phase: 4.2, width: 1.4 },
];

function buildPath(
  width: number,
  midY: number,
  amp: number,
  freq: number,
  phase: number,
): string {
  const k = (freq * 2 * Math.PI) / width;
  const step = 4;
  let d = "";
  for (let x = 0; x <= width; x += step) {
    const y =
      midY +
      amp *
        (0.7 * Math.sin(k * x + phase) +
          0.3 * Math.sin(2.3 * k * x + phase * 1.4));
    d += `${x === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

export default function VoiceWaveform({
  active,
  level = 1,
  width = 208,
  height = 56,
}: {
  active: boolean;
  /** 0–1 scale on amplitude (e.g. dampen while processing). */
  level?: number;
  width?: number;
  height?: number;
}) {
  const coreRefs = useRef<(SVGPathElement | null)[]>([]);
  const glowRefs = useRef<(SVGPathElement | null)[]>([]);
  // Keep the latest target in a ref so the rAF loop reads fresh values without
  // restarting (avoids animation hitches when state flips).
  const targetRef = useRef({ active, level });
  useEffect(() => {
    targetRef.current = { active, level };
  }, [active, level]);

  useEffect(() => {
    const midY = height / 2;
    const maxAmp = height / 2 - 3;
    const amps = LAYERS.map(() => 1); // current (eased) amplitude per layer
    const phases = LAYERS.map((l) => l.phase);
    let raf = 0;

    const loop = () => {
      const { active: a, level: lv } = targetRef.current;
      for (let i = 0; i < LAYERS.length; i++) {
        const L = LAYERS[i];
        const target = a ? L.amp * maxAmp * lv : 1.5;
        amps[i] += (target - amps[i]) * 0.08;
        phases[i] += L.speed;
        const d = buildPath(width, midY, amps[i], L.freq, phases[i]);
        coreRefs.current[i]?.setAttribute("d", d);
        glowRefs.current[i]?.setAttribute("d", d);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ pointerEvents: "none", display: "block" }}
      aria-hidden
    >
      <defs>
        <filter id="vw-glow" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <linearGradient id="vw-base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ec4899" stopOpacity="0" />
          <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* faint centre line, echoing the reference image's horizontal streak */}
      <line
        x1="0"
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="url(#vw-base)"
        strokeWidth="1.5"
      />

      {/* soft glow pass */}
      <g filter="url(#vw-glow)" opacity="0.55">
        {LAYERS.map((L, i) => (
          <path
            key={`g-${i}`}
            ref={(el) => {
              glowRefs.current[i] = el;
            }}
            fill="none"
            stroke={L.color}
            strokeWidth={L.width + 2}
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* crisp core pass */}
      <g>
        {LAYERS.map((L, i) => (
          <path
            key={`c-${i}`}
            ref={(el) => {
              coreRefs.current[i] = el;
            }}
            fill="none"
            stroke={L.color}
            strokeWidth={L.width}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  );
}
