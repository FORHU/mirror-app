"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { performRestart } from "@/modules/shared/voice/sessionCommands";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";

export default function RestartButton() {
    const [isPending, setIsPending] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();

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

    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        handleAction();
    };

    const handleClick = () => {
        handleAction();
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
                onTouchStart={handleTouchStart}
                onClick={handleClick}
                disabled={isPending}
                className={`text-[9px] px-3 py-1.5 border rounded-lg uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 ${isPending
                    ? "border-white/30 text-white/70 bg-white/10"
                    : "border-white/10 text-white/25 hover:bg-white/5 active:scale-95"
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
