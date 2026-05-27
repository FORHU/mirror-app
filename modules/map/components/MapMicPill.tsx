"use client";

import { useState } from "react";
import { Mic, MicOff, Loader2, Volume2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
} as const;

export default function MapMicPill() {
  const { voiceState, transcript, reply, error, toggle } = useVoiceContext();
  const [showTranscript, setShowTranscript] = useState(false);

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

  const micIcon = isListening ? (
    <MicOff className="w-5 h-5 text-red-400" />
  ) : isProcessing ? (
    <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
  ) : isSpeaking ? (
    <Volume2 className="w-5 h-5 text-white/80" />
  ) : (
    <Mic className="w-5 h-5 text-white/80" />
  );

  const pillBorder = isListening
    ? "1px solid rgba(239,68,68,0.6)"
    : isSpeaking || isProcessing
      ? "1px solid rgba(255,255,255,0.3)"
      : "1px solid rgba(255,255,255,0.12)";

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-none">
      {/* Transcript bubble — shown only when toggled on */}
      <AnimatePresence>
        {showTranscript && hasContent && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none w-80 rounded-2xl px-4 py-3"
            style={PANEL}
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
                  <p className="text-sm text-white/90 leading-snug">
                    <span className="font-semibold text-white/60">AI:</span>{" "}
                    {reply}
                  </p>
                )}
              </>
            )}
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
              onClick={() => setShowTranscript((v) => !v)}
              className="w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{
                background: showTranscript ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.85)",
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
          transition={isListening ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } : {}}
          className="flex items-center gap-3 px-6 py-3.5 rounded-full transition-all active:scale-95"
          style={{ ...PANEL, border: pillBorder, boxShadow: isActive ? "0 0 20px rgba(255,255,255,0.08)" : "none" }}
        >
          {micIcon}
          <span className="text-sm font-light text-white/80 tracking-wide select-none">{label}</span>
        </motion.button>
      </div>
    </div>
  );
}
