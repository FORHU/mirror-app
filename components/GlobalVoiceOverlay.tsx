"use client";

import { motion, AnimatePresence } from "motion/react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { usePathname } from "next/navigation";
import VoiceWaveform from "@/components/VoiceWaveform";
import VoiceTranscriptBubble from "@/components/VoiceTranscriptBubble";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

const NO_MIC_ROUTES = ["/wardrobe/create"];

// The shared tap-to-talk mic renders on every page. It's hidden only while
// /ai-assistant sits on its idle "Tap to start" welcome screen, so the spoken
// greeting gate isn't bypassed by tapping the mic directly.
export default function GlobalVoiceOverlay() {
  const assistantIdle = useMirrorStore((s) => s.assistantIdle);
  const pathname = usePathname();
  if (assistantIdle) return null;
  if (NO_MIC_ROUTES.some((r) => pathname.startsWith(r))) return null;
  return <VoiceUI />;
}

function VoiceUI() {
  const { voiceState, transcript, reply, error, toggle, chatHistory } =
    useVoiceContext();
  const pathname = usePathname();
  const isChatOpen = useMirrorStore((s) => s.isChatOpen);
  const isCosmeticsPage = pathname.startsWith("/ai-recommendation-cosmetic");
  const visibleHistory = isCosmeticsPage ? chatHistory.slice(-1) : chatHistory;

  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";
  const isActive = isProcessing || isSpeaking;

  return (
    <>
      {/* Chat History Overlay — centered above the mic, matching the bubble */}
      <div
        className={`fixed z-9999 inset-x-0 flex justify-center pointer-events-none ${
          isCosmeticsPage ? "bottom-33" : "bottom-40"
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

      {/* Waveform pill — visible only while processing or speaking */}
      {(isProcessing || isSpeaking) && (
        <div className="fixed z-9999 bottom-6 inset-x-0 flex justify-center pointer-events-none">
          <motion.button
            onClick={toggle}
            className="flex items-center justify-center shadow-2xl pointer-events-auto"
            style={{
              width: 224,
              height: 64,
              borderRadius: 9999,
              background: "rgba(8,8,14,0.9)",
              border: "2px solid rgba(120,180,255,0.45)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 18px rgba(120,150,210,0.26)",
              overflow: "hidden",
              padding: 0,
            }}
            whileTap={{ scale: 0.95 }}
            aria-label="Voice assistant"
          >
            <VoiceWaveform
              active={isActive}
              level={isProcessing ? 0.45 : 1}
              width={208}
              height={56}
            />
          </motion.button>
        </div>
      )}
    </>
  );
}
