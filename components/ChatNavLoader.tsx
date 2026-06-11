import React from "react";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

interface ChatNavLoaderProps {
  spinnerColor?: "white" | "pink";
}

export function ChatNavLoader({ spinnerColor = "white" }: ChatNavLoaderProps) {
  const chatNavPending = useMirrorStore((s) => s.chatNavPending);
  const chatStreamingText = useMirrorStore((s) => s.chatStreamingText);

  if (!chatNavPending) return null;

  const spinnerClass =
    spinnerColor === "pink"
      ? "border-pink-500/20 border-t-pink-400/80"
      : "border-white/20 border-t-white/80";

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
      <div
        className={`w-8 h-8 rounded-full border-2 animate-spin mb-6 ${spinnerClass}`}
      />
      {chatStreamingText && (
        <p className="text-white/70 text-base font-light text-center max-w-sm leading-relaxed px-8">
          {chatStreamingText}
        </p>
      )}
    </div>
  );
}
