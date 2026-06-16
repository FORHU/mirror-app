"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { performRestart } from "@/modules/shared/voice/sessionCommands";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";

interface RestartButtonProps {
  onConfirmChange?: (isConfirming: boolean) => void;
}

export default function RestartButton({
  onConfirmChange,
}: RestartButtonProps = {}) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const touchHandledRef = useRef(false);

  const [showConfirm, setShowConfirm] = useState(false);

  const handleSetConfirm = (val: boolean) => {
    setShowConfirm(val);
    if (onConfirmChange) onConfirmChange(val);
  };

  const { data: sessionId } = useQuery({
    queryKey: ["currentSessionId"],
    queryFn: () => chatWonderService.getCurrentSessionId(),
    refetchInterval: 5000, // keep it slightly updated if it resets elsewhere
  });

  const handleAction = () => {
    if (isPending) return;
    setIsPending(true);
    handleSetConfirm(false);
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
        <span className="absolute -top-14 text-[16px] text-white/30 tracking-widest uppercase font-mono whitespace-nowrap pointer-events-none">
          {sessionId}
        </span>
      )}

      {showConfirm ? (
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
          <span className="text-white/50 text-[10px] font-semibold uppercase tracking-[0.15em] pl-3 pr-1">
            Restart?
          </span>
          <button
            onClick={handleAction}
            className="px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] transition-all bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/20 active:scale-95"
            style={{ touchAction: "manipulation" }}
          >
            Yes
          </button>
          <button
            onClick={() => handleSetConfirm(false)}
            className="px-6 py-2.5 rounded-full text-[11px] font-medium uppercase tracking-[0.1em] transition-all text-white/60 hover:text-white/90 hover:bg-white/10 active:scale-95"
            style={{ touchAction: "manipulation" }}
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onTouchStart={() => {
            touchHandledRef.current = true;
            handleSetConfirm(true);
          }}
          onClick={() => {
            if (touchHandledRef.current) {
              touchHandledRef.current = false;
              return;
            }
            handleSetConfirm(true);
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
      )}
    </div>
  );
}
