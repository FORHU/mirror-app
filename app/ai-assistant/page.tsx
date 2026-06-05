"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import MirrorHeader from "@/components/MirrorHeader";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";
import { useProximitySensor } from "@/modules/shared/hooks/useProximitySensor";
import { useRouter } from "next/navigation";

const TAGLINES = [
  "Ask me to navigate anywhere.",
  "Step closer to check the weather.",
  "I can recommend outfits for your day.",
  "Your mirror. Always ready.",
  "Reflect. Navigate. Discover.",
];

/*
function generateGreetingPrompt() {
  const now = new Date();
  const hours = now.getHours();
  let timeOfDay = "morning";
  if (hours >= 12 && hours < 17) timeOfDay = "afternoon";
  else if (hours >= 17) timeOfDay = "evening";

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = days[now.getDay()];

  const hints = [
    "Ask if they want to pick out an outfit or check the map today.",
    "Ask if they are getting ready for work, or just relaxing.",
    "Ask what they are looking forward to exploring today.",
    "Ask if they need help planning their itinerary."
  ];
  const randomHint = hints[Math.floor(Math.random() * hints.length)];

  return `[SYSTEM] The user just walked up to the mirror. Greet them warmly. CRITICAL INSTRUCTION: DO NOT EMIT [STYLIST], [NAV_DATA], [GARMENT_DATA], OR [COSMETICS_DATA] BLOCKS. DO NOT NAVIGATE. DO NOT RECOMMEND OUTFITS OR COSMETICS YET. JUST SPEAK. It is currently ${dayOfWeek} ${timeOfDay}. ${randomHint} End by explicitly asking them the question so they can answer. Start listening after you speak.`;
}
*/

export default function AIAssistantPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceStateRef = useRef("idle");
  const submitTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  
  const [showIdle, setShowIdle] = useState(true);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const hasGreetedRef = useRef(false);

  const pageContext = useMemo(
    () => ({
      route: ROUTES.AI_ASSISTANT,
      pageName: "AI Assistant",
      activeStep: "conversation",
    }),
    [],
  );

  useVoice(pageContext);

  const {
    voiceState,
    transcript,
    reply,
    error,
    toggle,
    isListening,
    isProcessing,
    isSpeaking,
    chatHistory,
    submitText,
  } = useVoiceContext();

  const { isPresent, videoRef, status: sensorStatus } = useProximitySensor({
    intervalMs: 1000,
    missesUntilExit: 3,
  });

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    submitTextRef.current = submitText;
  }, [submitText]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, transcript, reply, error]);

  const taglines = useMemo(() => {
    const hour = new Date().getHours();
    const timeTagline =
      hour >= 5 && hour < 12
        ? "Good morning. What's on your mind?"
        : hour >= 17
          ? "Good evening. Ready when you are."
          : "Ready when you are.";
    return [...TAGLINES, timeTagline];
  }, []);

  // Cycle taglines every 5s while idle screen is visible
  useEffect(() => {
    if (!showIdle) return;
    const id = setInterval(
      () => setTaglineIndex((i) => (i + 1) % taglines.length),
      5000,
    );
    return () => clearInterval(id);
  }, [showIdle, taglines.length]);

  const handleWake = useCallback(() => {
    if (!showIdle) return;
    setShowIdle(false);
    
    /*
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const dynamicPrompt = generateGreetingPrompt();
      submitTextRef.current(dynamicPrompt).catch(() => {});
    }
    */
    hasGreetedRef.current = true;
  }, [showIdle]);

  // Handle Proximity Changes
  useEffect(() => {
    if (isPresent && showIdle) {
      // User arrived!
      handleWake();
    } else if (!isPresent && !showIdle && sensorStatus !== "unavailable") {
      // User walked away! (Only if camera is actually available to tell us they left)
      setShowIdle(true);
      hasGreetedRef.current = false;
      // Restart the session completely
      import("@/modules/shared/api/chat-wonder.service").then((m) => {
         m.chatWonderService.restart().finally(() => {
           window.location.reload();
         });
      });
    }
  }, [isPresent, showIdle, handleWake, sensorStatus]);

  const status = isListening
    ? "Listening"
    : isProcessing
      ? "Thinking"
      : isSpeaking
        ? "Speaking"
        : "Idle";

  const latest = chatHistory[chatHistory.length - 1];
  const displayUser = transcript || latest?.user || "";
  const displayReply =
    error || reply || latest?.assistant || "Hi! What can I do for you?";

  const handleMicTap = useCallback(() => {
    toggle();
  }, [toggle]);

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      <MirrorHeader
        right={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]">
            <Sparkles className="w-4 h-4 text-white/60" />
            <span className="text-white/65 text-xs">{status}</span>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {showIdle ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col items-center justify-center px-12 cursor-pointer relative"
            onClick={handleWake}
          >
            {/* 
              Placeholder Abstract Video Loop 
              Replace the src with "/background.mp4" when you have your own branded asset
            */}
            <video
              src="https://videos.pexels.com/video-files/3129671/3129671-uhd_3840_2160_30fps.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-60 z-0 pointer-events-none"
            />
            <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />

            <div
              className="flex items-center justify-center relative z-10"
              style={{ minHeight: "8rem" }}
            >
              <AnimatePresence mode="wait">
                <motion.p
                  key={taglineIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-white font-thin text-center leading-[1.15] tracking-tight"
                  style={{ fontSize: "clamp(2rem, 6.5vw, 3.75rem)" }}
                >
                  {taglines[taglineIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 relative z-10">
              <div className="h-px w-12 bg-white/15" />
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30 font-light drop-shadow-md">
                Step closer to begin
              </p>
            </div>

            <motion.div
              className="mt-10 flex flex-col items-center gap-3 relative z-10"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <div
                className="rounded-full border border-white/20"
                style={{ width: 48, height: 48 }}
              />
              <p className="text-[9px] uppercase tracking-[0.5em] text-white/25 font-light">
                Tap to start
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.main
            key="assistant"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-h-0 flex flex-col px-10 py-8"
          >
            {/* conversation — top half */}
            <div className="flex-1 min-h-0 flex flex-col justify-center max-w-2xl mx-auto w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${displayUser}-${displayReply}-${voiceState}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-8"
                >
                  {displayUser && (
                    <div className="text-right">
                      <p className="text-white/25 text-[9px] uppercase tracking-[0.4em] font-light mb-2">
                        You said
                      </p>
                      <p className="text-white/55 text-lg font-light leading-relaxed">
                        {displayUser}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/25 text-[9px] uppercase tracking-[0.4em] font-light mb-2">
                      Mirror
                    </p>
                    <p
                      className={`font-thin leading-[1.3] tracking-tight ${
                        error ? "text-red-300/75" : "text-white/90"
                      }`}
                      style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}
                    >
                      {displayReply}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ambient state indicator — centered in bottom half */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <motion.button
                type="button"
                onClick={handleMicTap}
                aria-label="Toggle voice input"
                className="rounded-full outline-none"
                style={{
                  width: 56,
                  height: 56,
                  background:
                    isListening
                      ? "rgba(255,255,255,0.10)"
                      : isSpeaking
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(255,255,255,0.04)",
                  border:
                    isListening
                      ? "1px solid rgba(255,255,255,0.40)"
                      : isSpeaking
                        ? "1px solid rgba(255,255,255,0.25)"
                        : "1px solid rgba(255,255,255,0.10)",
                }}
                animate={
                  isListening
                    ? { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }
                    : isProcessing
                      ? { opacity: [0.4, 0.9, 0.4] }
                      : isSpeaking
                        ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }
                        : { scale: 1, opacity: 0.4 }
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <p className="text-white/50 text-[10px] uppercase tracking-[0.4em] font-light">
                {status}
              </p>
              {sensorStatus === "unavailable" && (
                <p className="text-white/20 text-[9px] tracking-wide">
                  Camera unavailable
                </p>
              )}
            </div>

            <div ref={bottomRef} />
          </motion.main>
        )}
      </AnimatePresence>

      {/* Debug Sleep button for testers without cameras */}
      {sensorStatus === "unavailable" && !showIdle && (
        <button
          onClick={() => {
            setShowIdle(true);
            hasGreetedRef.current = false;
            import("@/modules/shared/api/chat-wonder.service").then((m) => {
              m.chatWonderService.restart().finally(() => {
                window.location.reload();
              });
            });
          }}
          className="absolute bottom-4 right-4 z-50 text-white/30 text-[10px] px-3 py-1.5 border border-white/20 rounded hover:bg-white/10 uppercase tracking-widest cursor-pointer"
        >
          Tester: Sleep
        </button>
      )}

      <video
        ref={videoRef}
        playsInline
        muted
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-0"
      />
    </div>
  );
}
