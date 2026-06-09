"use client";

import {
  Mic,
  Loader2,
  Volume2,
  MessageSquare,
  Navigation,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useMapStore } from "../store/useMapStore";

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
} as const;

export default function MapMicPill() {
  const {
    voiceState,
    transcript,
    reply,
    error,
    toggle,
    transcriptOpen,
    setTranscriptOpen,
  } = useVoiceContext();
  const showTranscript = transcriptOpen;
  const setShowTranscript = setTranscriptOpen;

  const selectedDestination = useMapStore((s) => s.selectedDestination);
  const suggestedPOIs = useMapStore((s) => s.suggestedPOIs);
  const isNavigating = !!selectedDestination;
  const isRecommending = !isNavigating && suggestedPOIs.length > 0;

  const isListening = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isListening || isProcessing || isSpeaking;

  const hasContent = !!(transcript || reply || error);

  const label = isListening
    ? "Listening…"
    : isProcessing
      ? "Thinking…"
      : isSpeaking
        ? "Speaking…"
        : "Ask Mirror";

  const RING_R = 14;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

  const micIcon = isListening ? (
    <div className="relative flex items-center justify-center">
      <Mic className="w-5 h-5 text-emerald-400 relative z-10" />
      {/* Depleting countdown ring — vanishes over 10 seconds */}
      <svg
        className="absolute pointer-events-none"
        width="36"
        height="36"
        viewBox="0 0 36 36"
        style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-90deg)" }}
      >
        <motion.circle
          cx="18"
          cy="18"
          r={RING_R}
          fill="none"
          stroke="rgba(34,197,94,0.75)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: RING_CIRCUMFERENCE }}
          transition={{ duration: 10, ease: "linear" }}
        />
      </svg>
    </div>
  ) : isProcessing ? (
    <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
  ) : isSpeaking ? (
    <Volume2 className="w-5 h-5 text-white/80" />
  ) : (
    <Mic className="w-5 h-5 text-white/80" />
  );

  const pillBorder = isListening
    ? "1px solid rgba(34,197,94,0.7)"
    : isSpeaking || isProcessing
      ? "1px solid rgba(255,255,255,0.3)"
      : "1px solid rgba(255,255,255,0.12)";

  // Lift pill above the nav bar (≈96px tall) when routing
  const bottomOffset = isNavigating ? "bottom-28" : "bottom-8";

  return (
    <div
      className={`fixed ${bottomOffset} left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-none transition-all duration-300`}
    >
      {/* Transcript bubble — wide, fixed height, shown only when toggled on */}
      <AnimatePresence>
        {showTranscript && hasContent && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none w-[88vw] rounded-2xl px-4 py-2.5"
            style={PANEL}
          >
            {error ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-red-400 text-[10px] font-semibold uppercase tracking-wider shrink-0">
                  Error
                </span>
                <p className="text-red-400 text-xs truncate">{error}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {transcript && (
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wider shrink-0 w-5 pt-px">
                      You
                    </span>
                    <p className="text-white/65 text-xs leading-relaxed line-clamp-1">
                      {transcript}
                    </p>
                  </div>
                )}
                {reply && (
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-blue-400 text-[10px] font-semibold uppercase tracking-wider shrink-0 w-5 pt-px">
                      AI
                    </span>
                    <p className="text-white/90 text-xs leading-relaxed line-clamp-3">
                      {reply}
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode context indicator */}
      <AnimatePresence>
        {(isNavigating || isRecommending) && (
          <motion.div
            key="mode-badge"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              background: isNavigating
                ? "rgba(33,68,192,0.25)"
                : "rgba(139,92,246,0.25)",
              border: isNavigating
                ? "1px solid rgba(96,165,250,0.4)"
                : "1px solid rgba(167,139,250,0.4)",
              backdropFilter: "blur(8px)",
            }}
          >
            {isNavigating ? (
              <Navigation className="w-3 h-3 text-blue-400" />
            ) : (
              <Sparkles className="w-3 h-3 text-violet-400" />
            )}
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{
                color: isNavigating ? "rgb(96,165,250)" : "rgb(167,139,250)",
              }}
            >
              {isNavigating ? "Navigating" : "Exploring"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multi-stop tip — shown during any active voice state */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="multi-stop-tip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(234,179,8,0.12)",
              border: "1px solid rgba(234,179,8,0.35)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Lightbulb className="w-3 h-3 text-yellow-400 shrink-0" />
            <span className="text-xs text-yellow-200/80 tracking-wide">
              Say &quot;and&quot; or &quot;then&quot; between stops
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill row: transcript toggle + mic pill */}
      <div className="pointer-events-auto flex items-center gap-3">
        {/* Transcript toggle — only when there's content */}
        <AnimatePresence>
          {hasContent && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{
                background: showTranscript
                  ? "rgba(0,0,0,0.95)"
                  : "rgba(0,0,0,0.85)",
                backdropFilter: "blur(12px)",
                border: showTranscript
                  ? "1.5px solid rgba(255,255,255,0.8)"
                  : "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <MessageSquare className="w-4 h-4 text-white" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Mic pill */}
        <motion.button
          onClick={toggle}
          animate={isListening ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={
            isListening
              ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
              : {}
          }
          className="flex items-center gap-3 px-6 py-3.5 rounded-full transition-all active:scale-95"
          style={{
            ...PANEL,
            border: pillBorder,
            boxShadow: isListening
              ? "0 0 24px rgba(34,197,94,0.55), 0 0 8px rgba(34,197,94,0.3)"
              : isActive
                ? "0 0 20px rgba(255,255,255,0.08)"
                : "none",
            background: isListening ? "rgba(5,20,12,0.90)" : PANEL.background,
          }}
        >
          {micIcon}
          <span className="text-sm font-light text-white/80 tracking-wide select-none">
            {label}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
