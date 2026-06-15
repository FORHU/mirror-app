"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { QuickResponseChips, type PromptCategory } from "./QuickResponseChips";
import type { WeatherData } from "@/modules/shared/hooks/useWeather";

interface PromptFloaterProps {
  prompts?: string[];
  categories?: PromptCategory[];
  /** Positioning classes for the floating button container. */
  className?: string;
  /** Which direction the dropdown expands. Default: "above". */
  direction?: "above" | "below";
  /** Override default submitText — when provided, skips ChatWonder entirely */
  onSelect?: (prompt: string) => void;
  /** When provided, appends current weather context to every prompt before submission */
  weather?: WeatherData | null;
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
  direction = "above",
  onSelect,
  weather,
}: PromptFloaterProps) {
  const { isProcessing, isSpeaking } = useVoiceContext();
  const isIdle = !isProcessing && !isSpeaking;
  const [open, setOpen] = useState(false);
  const [displayedPrompts, setDisplayedPrompts] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(() => setOpen(false), 12000);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const handleToggle = () => {
    if (!open && prompts && prompts.length > 0) {
      const shuffled = [...prompts].sort(() => 0.5 - Math.random());
      setDisplayedPrompts(shuffled.slice(0, 3));
    }
    setOpen((o) => !o);
  };

  if (!isIdle) return null;

  const isBelow = direction === "below";

  return (
    <div
      className={
        className ?? "fixed bottom-[104px] left-1/2 -translate-x-1/2 z-40"
      }
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{
              opacity: 0,
              y: isBelow ? -8 : 12,
              scale: 0.96,
              x: "-50%",
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: "-50%",
            }}
            exit={{
              opacity: 0,
              y: isBelow ? -8 : 12,
              scale: 0.96,
              x: "-50%",
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`absolute w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl left-1/2 ${isBelow ? "top-full mt-3" : "bottom-full mb-3"}`}
            style={{
              background: "rgba(10,10,18,0.92)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
              maxHeight: "60vh",
              overflowY: "auto",
              scrollbarWidth: "none",
            }}
          >
            <div style={{ overflow: "hidden" }}>
              <QuickResponseChips
                prompts={prompts ? displayedPrompts : undefined}
                categories={categories}
                onPromptSelect={() => setOpen(false)}
                onSelect={onSelect}
                weather={weather}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleToggle}
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
          Suggestions
        </span>
      </motion.button>
    </div>
  );
}
