"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { performRestart } from "@/modules/shared/voice/sessionCommands";

export default function RestartButton() {
  const router = useRouter();
  const pendingRef = useRef(false);

  const handleRestart = (e: React.TouchEvent | React.MouseEvent) => {
    // Suppress the synthetic click that follows a touchStart on mobile
    if (e.type === "click" && typeof window !== "undefined" && "ontouchstart" in window) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    performRestart(router).catch(() => {}).finally(() => {
      pendingRef.current = false;
    });
  };

  return (
    <button
      type="button"
      onTouchStart={handleRestart}
      onClick={handleRestart}
      className="fixed bottom-4 left-4 z-50 text-white/25 text-[9px] px-3 py-1.5 border border-white/10 rounded-lg uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95 cursor-pointer"
    >
      New Session
    </button>
  );
}
