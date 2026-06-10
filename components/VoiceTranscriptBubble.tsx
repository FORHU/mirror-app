"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// How long the bubble lingers after the last transcript/reply update before it
// fades itself away.
const AUTO_DISMISS_MS = 6000;

export interface VoiceTranscriptBubbleProps {
  transcript: string;
  reply: string;
  error: string | null;
  /** Hidden while the full chat-history panel is open. */
  isChatOpen: boolean;
  /** Cosmetics page uses a tighter/narrower variant. */
  isCosmeticsPage: boolean;
}

// The live "You: … / AI: …" transcript bubble shown above the voice mic while an
// exchange is in flight. It lives in a full-width, centered wrapper (matching the
// mic button) so it aligns to the center of the screen instead of hugging the
// right edge. Extracted from GlobalVoiceOverlay so positioning/markup changes
// here can't affect the chat-history panel, the chat toggle, or the mic.
export default function VoiceTranscriptBubble({
  transcript,
  reply,
  error,
  isChatOpen,
  isCosmeticsPage,
}: VoiceTranscriptBubbleProps) {
  // Auto-dismiss: each distinct transcript/reply/error is shown, then the timer
  // marks that exact content as "dismissed" so the bubble fades a few seconds
  // after it settles. New content changes the signature and shows again. State
  // is only set inside the timeout (never synchronously in the effect body).
  const signature =
    transcript || reply || error ? `${transcript}|${reply}|${error}` : "";
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (!signature) return;
    const timer = setTimeout(
      () => setDismissedSignature(signature),
      AUTO_DISMISS_MS,
    );
    return () => clearTimeout(timer);
  }, [signature]);

  const show =
    Boolean(signature) && !isChatOpen && signature !== dismissedSignature;

  return (
    <div
      className={`fixed z-9999 inset-x-0 flex justify-center pointer-events-none ${
        isCosmeticsPage ? "bottom-[132px]" : "bottom-[160px]"
      }`}
    >
      <AnimatePresence>
        {show && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className={
              isCosmeticsPage ? "w-[min(20rem,calc(100vw-2.5rem))]" : "w-72"
            }
          >
            <div
              className={`rounded-2xl shadow-2xl overflow-y-auto pointer-events-auto ${
                isCosmeticsPage ? "px-3 py-2 max-h-[24vh]" : "px-4 py-3"
              }`}
              style={{
                background: "rgba(10,10,18,0.88)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {error ? (
                <p className="text-xs text-red-400">{error}</p>
              ) : (
                <>
                  {transcript && (
                    <p className="text-xs text-white/50 leading-tight mb-1">
                      <span className="font-semibold text-white/70">You:</span>{" "}
                      {transcript}
                    </p>
                  )}
                  {reply && (
                    <p
                      className={`text-white whitespace-pre-line ${
                        isCosmeticsPage
                          ? "text-xs leading-relaxed"
                          : "text-sm leading-snug"
                      }`}
                    >
                      <span className="font-semibold text-[#4fc3f7]">AI:</span>{" "}
                      {reply}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
