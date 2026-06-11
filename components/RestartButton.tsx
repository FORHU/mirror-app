"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { performRestart } from "@/modules/shared/voice/sessionCommands";

export default function RestartButton() {
  const router = useRouter();
  const pendingRef = useRef(false);

  const handleAction = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    performRestart(router).catch(() => {}).finally(() => {
      pendingRef.current = false;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevents the browser from firing the synthetic click
    handleAction();
  };

  const handleClick = () => {
    handleAction();
  };

  return (
    <button
      type="button"
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      className="fixed bottom-4 left-4 z-50 text-white/25 text-[9px] px-3 py-1.5 border border-white/10 rounded-lg uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95 cursor-pointer"
    >
      New Session
    </button>
  );
}
