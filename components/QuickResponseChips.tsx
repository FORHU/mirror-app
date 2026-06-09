"use client";

import { motion, AnimatePresence } from "motion/react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";

// ── Date helpers — computed at render time so prompts always carry today's date ──

export function getToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Returns the label for the next occurrence of `targetDay` (0=Sun … 6=Sat). Never returns today. */
export function nextWeekday(targetDay: number): string {
  const today = new Date();
  const diff = (targetDay - today.getDay() + 7) % 7 || 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface QuickResponseChipsProps {
  prompts: string[];
  className?: string;
}

export function QuickResponseChips({ prompts, className }: QuickResponseChipsProps) {
  const { isListening, isProcessing, isSpeaking, submitText } = useVoiceContext();
  const isIdle = !isListening && !isProcessing && !isSpeaking;

  const handleTap = (prompt: string) => {
    void submitText(prompt);
  };

  return (
    <AnimatePresence>
      {isIdle && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`flex flex-wrap gap-2 justify-center px-4 pb-5 ${className ?? ""}`}
        >
          {prompts.map((prompt, i) => (
            <motion.button
              key={prompt}
              type="button"
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.055, duration: 0.28, ease: "easeOut" }}
              onTouchStart={() => handleTap(prompt)}
              onClick={() => handleTap(prompt)}
              className="px-4 py-2 rounded-full text-left text-[11px] leading-snug font-light text-white/60 border border-white/10 transition-colors active:bg-white/10"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                maxWidth: "320px",
              }}
            >
              {prompt}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
