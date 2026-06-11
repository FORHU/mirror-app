"use client";

import { motion, AnimatePresence } from "motion/react";
import { Mic, Loader2, Volume2 } from "lucide-react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { usePathname } from "next/navigation";
import VoiceWaveform from "@/components/VoiceWaveform";
import VoiceTranscriptBubble from "@/components/VoiceTranscriptBubble";
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
  const micBusy = useMirrorStore((s) => s.micBusy);
  const isCosmeticsPage = pathname.startsWith("/ai-recommendation-cosmetic");
  const visibleHistory = isCosmeticsPage ? chatHistory.slice(-1) : chatHistory;

  const isListening = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isListening || isProcessing || isSpeaking;
  // Disable the mic while a page is fetching (suggestion load) so a tap can't
  // kick off a competing voice request mid-request.
  const disabled = micBusy && !isActive;

  const micIcon = isListening ? (
    <Mic className="w-7 h-7 text-emerald-400" />
  ) : isProcessing ? (
    <Loader2 className="w-7 h-7 text-[#4fc3f7] animate-spin" />
  ) : isSpeaking ? (
    <Volume2 className="w-7 h-7 text-[#4fc3f7]" />
  ) : disabled ? (
    <Loader2 className="w-7 h-7 text-white/40 animate-spin" />
  ) : (
    <Mic className="w-7 h-7 text-white" />
  );

  return (
    <>
      {/* Chat History Overlay — centered above the mic, matching the bubble */}
      <div
        className={`fixed z-9999 inset-x-0 flex justify-center pointer-events-none ${
          isCosmeticsPage ? "bottom-[132px]" : "bottom-[160px]"
        }`}
      >
        <AnimatePresence>
          {isChatOpen && visibleHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              className={`pointer-events-auto ${
                isCosmeticsPage ? "w-[min(20rem,calc(100vw-2.5rem))]" : "w-80"
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
      </div>

      {/* Transcript / reply bubble — centered above the mic button */}
      <VoiceTranscriptBubble
        transcript={transcript}
        reply={reply}
        error={error}
        isChatOpen={isChatOpen}
        isCosmeticsPage={isCosmeticsPage}
      />

      {/* Floating voice control — centered at the bottom. Compact circle while
          listening (ring gives feedback), morphs into a flowing waveform pill
          while processing/speaking. Centered via the wrapper so framer-motion's
          scale/width animations don't fight a translate transform. */}
      <div className="fixed z-9999 bottom-6 inset-x-0 flex justify-center pointer-events-none">
        <motion.button
          onClick={disabled ? undefined : toggle}
          disabled={disabled}
          className="flex items-center justify-center shadow-2xl pointer-events-auto"
          style={{
            height: 64,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "pointer",
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
              ? "0 0 18px rgba(34,197,94,0.32)"
              : isActive
                ? "0 0 18px rgba(120,150,210,0.26)"
                : "0 4px 20px rgba(0,0,0,0.45)",
            overflow: "hidden",
            padding: 0,
          }}
          whileTap={{ scale: 0.95 }}
          animate={{
            width: isProcessing || isSpeaking ? 224 : 64,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          aria-label="Voice assistant"
        >
          {isProcessing || isSpeaking ? (
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
