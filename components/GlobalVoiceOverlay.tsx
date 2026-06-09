"use client";

import { motion, AnimatePresence } from "motion/react";
import { Mic, Loader2, Volume2, MessageSquare } from "lucide-react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { usePathname } from "next/navigation";
import VoiceWaveform from "@/components/VoiceWaveform";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

// The shared tap-to-talk mic renders on every page. It's hidden only while
// /ai-assistant sits on its idle "Tap to start" welcome screen, so the spoken
// greeting gate isn't bypassed by tapping the mic directly.
export default function GlobalVoiceOverlay() {
  const assistantIdle = useMirrorStore((s) => s.assistantIdle);
  if (assistantIdle) return null;
  return <VoiceUI />;
}

function VoiceUI() {
  const { voiceState, transcript, reply, error, toggle, chatHistory } =
    useVoiceContext();
  const pathname = usePathname();
  const isChatOpen = useMirrorStore((s) => s.isChatOpen);
  const setIsChatOpen = useMirrorStore((s) => s.setIsChatOpen);
  const isCosmeticsPage = pathname.startsWith("/ai-recommendation-cosmetic");
  const visibleHistory = isCosmeticsPage ? chatHistory.slice(-1) : chatHistory;

  const isListening = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isListening || isProcessing || isSpeaking;

  const micIcon = isListening ? (
    <Mic className="w-7 h-7 text-emerald-400" />
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
        {isChatOpen && visibleHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className={`fixed right-5 z-9999 pointer-events-auto ${
              isCosmeticsPage
                ? "bottom-[132px] w-[min(20rem,calc(100vw-2.5rem))]"
                : "bottom-[160px] w-80"
            }`}
          >
            <div
              className={`rounded-2xl shadow-2xl flex flex-col overflow-y-auto ${
                isCosmeticsPage
                  ? "gap-2 p-3 max-h-[34vh]"
                  : "gap-3 p-4 max-h-[60vh]"
              }`}
              style={{
                background: "rgba(10,10,18,0.92)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {visibleHistory.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <p className="text-xs text-white/60 leading-tight bg-white/5 p-2 rounded-lg rounded-tr-none self-end max-w-[85%]">
                    {item.user}
                  </p>
                  <p
                    className={`text-white bg-[#4fc3f7]/10 rounded-lg rounded-tl-none self-start max-w-[90%] border border-[#4fc3f7]/20 whitespace-pre-line ${
                      isCosmeticsPage
                        ? "text-xs leading-relaxed p-2"
                        : "text-sm leading-snug p-2.5"
                    }`}
                  >
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
            className={`fixed z-9999 right-5 ${
              isCosmeticsPage
                ? "bottom-[132px] w-[min(20rem,calc(100vw-2.5rem))]"
                : "bottom-[160px] w-72"
            }`}
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

      {/* Toggle Chat History */}
      {chatHistory.length > 0 && (
        <motion.button
          onClick={() => setIsChatOpen(!isChatOpen)}
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

      {/* Floating voice control — centered at the bottom. Compact circle while
          listening (ring gives feedback), morphs into a flowing waveform pill
          while processing/speaking. Centered via the wrapper so framer-motion's
          scale/width animations don't fight a translate transform. */}
      {/* bottom-28 on /ai-assistant clears AssistantNavBar; bottom-6 everywhere else */}
      <div className={`fixed z-9999 ${pathname === "/ai-assistant" ? "bottom-28" : "bottom-6"} inset-x-0 flex justify-center pointer-events-none`}>
      <motion.button
        onClick={toggle}
        className="flex items-center justify-center shadow-2xl pointer-events-auto"
        style={{
          height: 64,
          borderRadius: 9999,
          background: isListening
            ? "rgba(5,20,12,0.92)"
            : isActive
              ? "rgba(8,8,14,0.9)"
              : "rgba(20,20,30,0.85)",
          border: isListening
            ? "2px solid rgba(34,197,94,0.7)"
            : isActive
              ? "2px solid rgba(120,180,255,0.45)"
              : "2px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px)",
          boxShadow: isListening
            ? "0 0 28px rgba(34,197,94,0.55), 0 0 8px rgba(34,197,94,0.3)"
            : isActive
              ? "0 0 30px rgba(90,150,255,0.4)"
              : "0 4px 24px rgba(0,0,0,0.5)",
          overflow: "hidden",
          padding: 0,
        }}
        whileTap={{ scale: 0.95 }}
        animate={{
          width: (isProcessing || isSpeaking) ? 224 : 64,
        }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        aria-label="Voice assistant"
      >
        {(isProcessing || isSpeaking) ? (
          <VoiceWaveform
            active={isActive}
            level={isProcessing ? 0.45 : 1}
            width={208}
            height={56}
          />
        ) : (
          micIcon
        )}
      </motion.button>
      </div>
    </>
  );
}
