"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Loader2, Volume2 } from "lucide-react";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { usePathname } from "next/navigation";
import VoiceWaveform from "@/components/VoiceWaveform";
import VoiceTranscriptBubble from "@/components/VoiceTranscriptBubble";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

/** Master switch for the shared mic UI (mic button, transcript bubble, chat
 *  history) on all pages. Flip to true to bring it back — voice playback
 *  (TTS replies) is unaffected either way, only the on-screen controls. */
const MIC_UI_ENABLED = false;

// The shared tap-to-talk mic renders on every page. It's hidden only while
// /ai-assistant sits on its idle "Tap to start" welcome screen, so the spoken
// greeting gate isn't bypassed by tapping the mic directly.
export default function GlobalVoiceOverlay() {
  const assistantIdle = useMirrorStore((s) => s.assistantIdle);
  if (!MIC_UI_ENABLED || assistantIdle) return null;
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

  // Elapsed recording time (mm:ss), shown in the mic while listening. Resets
  // whenever recording starts/stops.
  const [recordSecs, setRecordSecs] = useState(0);
  useEffect(() => {
    if (!isListening) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the clock when a recording begins; the interval below drives it after.
    setRecordSecs(0);
    const id = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isListening]);
  const recordLabel = `${Math.floor(recordSecs / 60)}:${String(
    recordSecs % 60,
  ).padStart(2, "0")}`;

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

      {/* Floating voice control — centered at the bottom. While recording it
          shows a live waveform + a "Tap to stop" cue (the mic no longer
          auto-stops); it also morphs into the flowing pill while
          processing/speaking. Centered via the wrapper so framer-motion's
          scale/width animations don't fight a translate transform. */}
      <div className="fixed z-9999 bottom-6 inset-x-0 flex flex-col items-center gap-2 pointer-events-none">
        {isListening && (
          <span
            className="pointer-events-none flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white/90"
            style={{
              background: "rgba(5,20,12,0.85)",
              border: "1px solid rgba(34,197,94,0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span className="font-mono tabular-nums text-emerald-300">
              {recordLabel}
            </span>
            <span className="text-white/40">·</span>
            Tap to stop
          </span>
        )}
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
            width: isActive ? 224 : 64,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          aria-label={isListening ? "Tap to stop recording" : "Voice assistant"}
        >
          {isActive ? (
            <VoiceWaveform
              active={isActive}
              level={isListening ? 1 : isProcessing ? 0.45 : 1}
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
