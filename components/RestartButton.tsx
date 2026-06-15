"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { performRestart } from "@/modules/shared/voice/sessionCommands";

export default function RestartButton() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const touchHandledRef = useRef(false);

  const handleAction = () => {
    if (isPending) return;
    setIsPending(true);
    queryClient.removeQueries({ queryKey: ["chatWonder"] });
    performRestart(router).finally(() => {
      setIsPending(false);
    });
  };

  return (
    <button
      type="button"
      onTouchStart={() => {
        touchHandledRef.current = true;
        handleAction();
      }}
      onClick={() => {
        if (touchHandledRef.current) {
          touchHandledRef.current = false;
          return;
        }
        handleAction();
      }}
      disabled={isPending}
      className={`whitespace-nowrap px-4 py-2 rounded-2xl text-[11px] font-medium uppercase tracking-[0.1em] transition-all duration-300 flex items-center gap-2 ${
        isPending
          ? "text-white/50 bg-white/5 border border-transparent"
          : "text-white/50 hover:text-white/85 hover:bg-white/5 active:bg-white/10 border border-transparent"
      }`}
    >
      {isPending && (
        <div className="w-2.5 h-2.5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      )}
      {isPending ? "Restarting..." : "Restart"}
    </button>
  );
}
