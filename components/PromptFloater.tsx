"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { QuickResponseChips, type PromptCategory } from "./QuickResponseChips";

interface PromptFloaterProps {
  prompts?: string[];
  categories?: PromptCategory[];
  /** Positioning classes for the floating button container. */
  className?: string;
}

/**
 * Collapsible floating button that reveals the QuickResponseChips on tap, so the
 * suggested prompts don't permanently occupy the screen. Hides entirely during
 * voice activity (suggestions only make sense while idle); tapping a chip submits
 * it and auto-collapses (the voice state leaves idle, unmounting the floater).
 */
export function PromptFloater({
  prompts,
  categories,
  className,
}: PromptFloaterProps) {
  const { isListening, isProcessing, isSpeaking } = useVoiceContext();
  const isIdle = !isListening && !isProcessing && !isSpeaking;
  const [open, setOpen] = useState(false);

  if (!isIdle) return null;

  return (
    <div
      className={
        className ?? "fixed bottom-[104px] left-1/2 -translate-x-1/2 z-40"
      }
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: 12, scale: 0.96, x: "-50%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute bottom-full left-1/2 mb-3 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,10,18,0.92)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
            }}
          >
            <QuickResponseChips prompts={prompts} categories={categories} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.96 }}
        aria-label={open ? "Hide suggestions" : "Show suggestions"}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl whitespace-nowrap"
        style={{
          background: open ? "rgba(79,195,247,0.18)" : "rgba(20,20,30,0.85)",
          border: open
            ? "1.5px solid rgba(79,195,247,0.6)"
            : "1.5px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {open ? (
          <X className="w-4 h-4 text-white/80" />
        ) : (
          <Sparkles className="w-4 h-4 text-white/80" />
        )}
        <span className="text-white/80 text-[11px] font-medium uppercase tracking-[0.18em]">
          {open ? "Close" : "Suggestions"}
        </span>
      </motion.button>
    </div>
  );
}
