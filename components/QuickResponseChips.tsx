"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";
import { MAP_PROMPT_KEY } from "@/modules/map";
import { FASHION_PROMPT_KEY } from "@/modules/fashion/constants";
import { COSMETIC_PROMPT_KEY } from "@/modules/cosmetics/constants";

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
  /** If set, navigates to this route when a chip in this category is tapped */
  route?: string;
}

interface QuickResponseChipsProps {
  /** Legacy flat-list mode (no tabs) */
  prompts?: string[];
  /** Categorised mode — renders tab selectors above the chips */
  categories?: PromptCategory[];
  className?: string;
  onPromptSelect?: () => void;
  /** Override default submitText — when provided, skips ChatWonder entirely */
  onSelect?: (prompt: string) => void;
  activePrompt?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickResponseChips({
  prompts,
  categories,
  className,
  onPromptSelect,
  onSelect,
  activePrompt,
}: QuickResponseChipsProps) {
  const { isListening, isProcessing, isSpeaking, submitText } =
    useVoiceContext();
  const isIdle = !isListening && !isProcessing && !isSpeaking;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(0);
  const touchHandledRef = useRef(false);

  // Resolve which prompts to show
  const hasTabs = categories && categories.length > 0;
  const activeCategory = hasTabs ? categories[activeTab] : null;
  const visiblePrompts = activeCategory
    ? activeCategory.prompts
    : (prompts ?? []);

  const HANDOFF_ROUTES: Record<string, string> = {
    [ROUTES.MAP]: MAP_PROMPT_KEY,
    [ROUTES.AI_RECOMMENDATION_FASHION]: FASHION_PROMPT_KEY,
    [ROUTES.AI_RECOMMENDATION_COSMETIC]: COSMETIC_PROMPT_KEY,
  };

  const handleTap = (prompt: string) => {
    onPromptSelect?.();
    const route = activeCategory?.route;
    if (route && HANDOFF_ROUTES[route]) {
      // Chips with a destination route bypass ChatWonder on the source page.
      // Write the prompt to the destination's handoff key so it processes the
      // query itself once mounted (with voiceState idle and location loaded).
      try {
        sessionStorage.setItem(HANDOFF_ROUTES[route], prompt);
      } catch {}
      router.push(route);
      return;
    }
    if (onSelect) {
      onSelect(prompt);
    } else {
      void submitText(prompt);
    }
    if (route) router.push(route);
  };

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
                    className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 select-none"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(255,255,255,0.03)",
                      border: active
                        ? "1px solid rgba(255,255,255,0.22)"
                        : "1px solid rgba(255,255,255,0.07)",
                      color: active
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(255,255,255,0.58)",
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
                  onTouchStart={() => {
                    touchHandledRef.current = true;
                    handleTap(prompt);
                  }}
                  onClick={() => {
                    if (touchHandledRef.current) {
                      touchHandledRef.current = false;
                      return;
                    }
                    handleTap(prompt);
                  }}
                  className={`px-4 py-2 rounded-2xl text-center text-[12px] leading-snug font-light transition-colors ${
                    prompt === activePrompt
                      ? "bg-white text-black border-white"
                      : "text-white/70 border border-white/10 active:bg-white/10 hover:text-white/90 hover:border-white/20"
                  }`}
                  style={{
                    background:
                      prompt === activePrompt
                        ? "#fff"
                        : "rgba(255,255,255,0.04)",
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
