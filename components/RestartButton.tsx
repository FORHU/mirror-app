"use client";

import { useEffect, useRef, useState } from "react";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";

export default function RestartButton() {
  const pendingRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const refreshSessionId = () => {
    chatWonderService
      .getCurrentSessionId()
      .then(setSessionId)
      .catch(() => setSessionId(null));
  };

  useEffect(() => {
    refreshSessionId();
  }, []);

  const handleAction = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    chatWonderService
      .restart()
      .catch(() => {})
      .finally(() => {
        pendingRef.current = false;
        refreshSessionId();
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        className="text-white/25 text-[9px] px-3 py-1.5 border border-white/10 rounded-lg uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95 cursor-pointer"
      >
        New Session
      </button>
      {sessionId && (
        <span className="text-white/20 text-[9px] tracking-wider select-text">
          {sessionId}
        </span>
      )}
    </div>
  );
}
