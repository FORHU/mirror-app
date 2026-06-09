"use client";

import { ShieldCheck } from "lucide-react";

/**
 * The privacy disclaimer shown above the grid. Copy is intentionally verbatim
 * from the product spec — the camera is a mirror, not a data collector.
 */
export function CameraDisclaimer() {
  return (
    <div
      className="flex items-center justify-center gap-3 shrink-0 mx-auto max-w-3xl px-5 py-2.5 rounded-full"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(10px)",
      }}
    >
      <ShieldCheck className="w-4 h-4 text-emerald-400/80 shrink-0" />
      <p className="text-white/55 text-xs sm:text-sm leading-tight text-center">
        Your camera is used only to power the mirror experience. No camera data
        is stored or saved.
      </p>
    </div>
  );
}
