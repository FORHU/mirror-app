"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Mic, MicOff, Loader2, Volume2, MessageSquare } from "lucide-react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { usePathname } from "next/navigation";

export default function GlobalVoiceOverlay() {
  const pathname = usePathname();
  if (pathname.startsWith("/map") || pathname === "/ai-recommendation-fashion/test-page") return null;
  return <VoiceUI />;
}

function VoiceUI() {
  const { voiceState, transcript, reply, error, toggle, chatHistory } =
    useVoiceContext();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const isListening = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isListening || isProcessing || isSpeaking;

  const micIcon = isListening ? (
    <MicOff className="w-7 h-7 text-red-400" />
  ) : isProcessing ? (
    <Loader2 className="w-7 h-7 text-[#4fc3f7] animate-spin" />
  ) : isSpeaking ? (
    <Volume2 className="w-7 h-7 text-[#4fc3f7]" />
  ) : (
    <Mic className="w-7 h-7 text-white" />
  );

  return (
    <>
      {/* Chat History Overlay */}
      <AnimatePresence>
        {isChatOpen && chatHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="fixed bottom-[160px] right-5 z-9999 w-80 pointer-events-auto"
          >
            <div
              className="rounded-2xl p-4 shadow-2xl flex flex-col gap-3 max-h-[60vh] overflow-y-auto"
              style={{
                background: "rgba(10,10,18,0.92)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {chatHistory.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <p className="text-xs text-white/60 leading-tight bg-white/5 p-2 rounded-lg rounded-tr-none self-end max-w-[85%]">
                    {item.user}
                  </p>
                  <p className="text-sm text-white leading-snug bg-[#4fc3f7]/10 p-2.5 rounded-lg rounded-tl-none self-start max-w-[90%] border border-[#4fc3f7]/20">
                    {item.assistant}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript / reply bubble — appears above the mic button */}
      <AnimatePresence>
        {(transcript || reply || error) && !isChatOpen && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-[160px] right-5 z-9999 w-72 pointer-events-none"
          >
            <div
              className="rounded-2xl px-4 py-3 shadow-2xl"
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
                    <p className="text-sm text-white leading-snug">
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

      {/* Toggle Chat History */}
      {chatHistory.length > 0 && (
        <motion.button
          onClick={() => setIsChatOpen((o) => !o)}
          className="fixed z-9999 flex items-center justify-center rounded-full shadow-lg transition-all"
          style={{
            bottom: "100px",
            right: "27px",
            width: 46,
            height: 46,
            background: isChatOpen
              ? "rgba(79,195,247,0.2)"
              : "rgba(20,20,30,0.85)",
            border: isChatOpen
              ? "1.5px solid rgba(79,195,247,0.7)"
              : "1.5px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
          }}
          whileTap={{ scale: 0.9 }}
          aria-label="Toggle Chat"
        >
          <MessageSquare className="w-5 h-5 text-white/80" />
        </motion.button>
      )}

      {/* Floating mic button — bottom-right */}
      <motion.button
        onClick={toggle}
        className="fixed bottom-6 right-5 z-9999 flex items-center justify-center rounded-full shadow-2xl transition-all"
        style={{
          width: 60,
          height: 60,
          background: isActive ? "rgba(79,195,247,0.2)" : "rgba(20,20,30,0.85)",
          border: isActive
            ? "2px solid rgba(79,195,247,0.7)"
            : "2px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px)",
          boxShadow: isActive
            ? "0 0 24px rgba(79,195,247,0.35)"
            : "0 4px 24px rgba(0,0,0,0.5)",
        }}
        whileTap={{ scale: 0.9 }}
        animate={isListening ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={isListening ? { repeat: Infinity, duration: 1.2 } : {}}
        aria-label="Voice assistant"
      >
        {micIcon}
      </motion.button>
    </>
  );
}
