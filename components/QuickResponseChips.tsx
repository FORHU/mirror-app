"use client";

import { useState } from "react";
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

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PromptCategory {
  /** Short label shown in the tab pill */
  label: string;
  /** Optional emoji / single-char icon shown before the label */
  icon?: string;
  prompts: string[];
}

interface QuickResponseChipsProps {
  /** Legacy flat-list mode (no tabs) */
  prompts?: string[];
  /** Categorised mode — renders tab selectors above the chips */
  categories?: PromptCategory[];
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickResponseChips({
  prompts,
  categories,
  className,
}: QuickResponseChipsProps) {
  const { isListening, isProcessing, isSpeaking, submitText } =
    useVoiceContext();
  const isIdle = !isListening && !isProcessing && !isSpeaking;

  const [activeTab, setActiveTab] = useState(0);

  const handleTap = (prompt: string) => {
    void submitText(prompt);
  };

  // Resolve which prompts to show
  const hasTabs = categories && categories.length > 0;
  const visiblePrompts = hasTabs
    ? (categories[activeTab]?.prompts ?? [])
    : (prompts ?? []);

  return (
    <AnimatePresence>
      {isIdle && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`flex flex-col gap-3 px-4 pb-4 ${className ?? ""}`}
        >
          {/* ── Category tabs ── */}
          {hasTabs && (
            <div className="flex items-center gap-2 justify-center flex-wrap">
              {categories!.map((cat, i) => {
                const active = i === activeTab;
                return (
                  <motion.button
                    key={cat.label}
                    type="button"
                    onClick={() => setActiveTab(i)}
                    onTouchStart={() => setActiveTab(i)}
                    whileTap={{ scale: 0.94 }}
                    className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 select-none"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(255,255,255,0.03)",
                      border: active
                        ? "1px solid rgba(255,255,255,0.22)"
                        : "1px solid rgba(255,255,255,0.07)",
                      color: active
                        ? "rgba(255,255,255,0.90)"
                        : "rgba(255,255,255,0.38)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                    }}
                  >
                    {cat.icon && (
                      <span className="text-[13px] leading-none">
                        {cat.icon}
                      </span>
                    )}
                    {cat.label}

                    {/* active dot */}
                    {active && (
                      <motion.span
                        layoutId="tab-dot"
                        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/60"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* ── Chips ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={hasTabs ? activeTab : "flat"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-wrap gap-2 justify-center"
            >
              {visiblePrompts.map((prompt, i) => (
                <motion.button
                  key={prompt}
                  type="button"
                  initial={{ opacity: 0, scale: 0.93 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: i * 0.04,
                    duration: 0.24,
                    ease: "easeOut",
                  }}
                  whileTap={{ scale: 0.96, opacity: 0.8 }}
                  onTouchStart={() => handleTap(prompt)}
                  onClick={() => handleTap(prompt)}
                  className="px-4 py-2 rounded-full text-left text-[11px] leading-snug font-light text-white/60 border border-white/10 transition-colors active:bg-white/10 hover:text-white/85 hover:border-white/20"
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
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
