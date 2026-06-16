"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { performRestart } from "@/modules/shared/voice/sessionCommands";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";

export default function RestartButton() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const touchHandledRef = useRef(false);

  const { data: sessionId } = useQuery({
    queryKey: ["currentSessionId"],
    queryFn: () => chatWonderService.getCurrentSessionId(),
    refetchInterval: 5000, // keep it slightly updated if it resets elsewhere
  });

  const handleAction = () => {
    if (isPending) return;
    setIsPending(true);
    // Clear all cached responses so the next scenario starts completely fresh
    queryClient.removeQueries({ queryKey: ["chatWonder"] });
    performRestart(router).finally(() => {
      setIsPending(false);
      // refetch the session ID now that it has restarted
      queryClient.invalidateQueries({ queryKey: ["currentSessionId"] });
    });
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {sessionId && (
        <span className="absolute -top-14 text-[16px] text-white/30 tracking-widest uppercase font-mono whitespace-nowrap">
          {sessionId}
        </span>
      )}
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
    </div>
  );
}
