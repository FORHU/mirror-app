"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import MirrorHeader from "@/components/MirrorHeader";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";
import { useProximitySensor } from "@/modules/shared/hooks/useProximitySensor";
import {
  useOverviewStore,
  adaptGarmentData,
  adaptMapsData,
} from "@/modules/overview";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import {
  cosmeticsService,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import { listenForSkinAnalysis } from "@/modules/shared/api/skinAnalysisSocket";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";

type GarmentRecommendationAction = {
  type: "GARMENT_RECOMMENDATION";
  response?: { garment_data?: unknown; maps_data?: unknown[] };
};
type OverviewVoiceAction = ChatWonderAction | GarmentRecommendationAction;

const TAGLINES = [
  "Ask me to navigate anywhere.",
  "Step closer to check the weather.",
  "I can recommend outfits for your day.",
  "Your mirror. Always ready.",
  "Reflect. Navigate. Discover.",
];

export default function AIAssistantPage() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceStateRef = useRef<string>("idle");
  const submitTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  const startListeningRef = useRef<() => void>(() => {});

  const setGarments = useOverviewStore((s) => s.setGarments);
  const setOutfits = useOverviewStore((s) => s.setOutfits);
  const setMap = useOverviewStore((s) => s.setMap);
  const setSkinAnalysisResult = useMirrorStore((s) => s.setSkinAnalysisResult);
  const setSkinCaptureUrl = useMirrorStore((s) => s.setSkinCaptureUrl);

  const [showIdle, setShowIdle] = useState(true);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const hasGreetedRef = useRef(false);
  const hasBeenPresentRef = useRef(false);
  const hasCapturedSkinRef = useRef(false);

  const pageContext = useMemo(
    () => ({
      route: ROUTES.AI_ASSISTANT,
      pageName: "AI Assistant",
      activeStep: "conversation",
    }),
    [],
  );

  const handleVoiceAction = useCallback(
    (raw: ChatWonderAction) => {
      const action = raw as OverviewVoiceAction;
      if (action.type !== "GARMENT_RECOMMENDATION") return;

      const response = (action as GarmentRecommendationAction).response;
      const { garments: g, outfits: o } = adaptGarmentData(
        response?.garment_data,
      );
      if (g.length) setGarments(g);
      if (o.length) setOutfits(o);

      const m = adaptMapsData(response?.maps_data?.[0]);
      if (m) setMap(m);
    },
    [setGarments, setOutfits, setMap],
  );

  useVoice(pageContext, handleVoiceAction);

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
    startListening,
  } = useVoiceContext();

  const {
    isPresent,
    videoRef,
    status: sensorStatus,
    captureFrame,
  } = useProximitySensor({
    intervalMs: 1000,
    missesUntilExit: 10,
  });

  // Background Skin Analysis
  useEffect(() => {
    if (isPresent && !hasCapturedSkinRef.current) {
      hasCapturedSkinRef.current = true;
      const frame = captureFrame();
      if (frame) {
        (async () => {
          try {
            const uploaded = await cosmeticsService.uploadCapture(frame);
            setSkinCaptureUrl(uploaded.fileUrl);
            await listenForSkinAnalysis({
              onComplete: (data) => {
                const analysis = data as SkinAnalysis;
                setSkinAnalysisResult(analysis);
              },
              onError: (msg) =>
                console.error("[skin-analysis] Background failed:", msg),
            });
            await cosmeticsService.startSkinAnalysis(uploaded.id);
          } catch (e) {
            console.error("[skin-analysis] Upload/start failed:", e);
          }
        })();
      }
    }
  }, [
    isPresent,
    captureFrame,
    setSkinAnalysisResult,
    setSkinCaptureUrl,
    submitText,
  ]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    submitTextRef.current = submitText;
    startListeningRef.current = startListening;
  }, [submitText, startListening]);

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

  // For development convenience: force a session restart on hard-refresh
  // so F5 acts like a "walk away" event and resets the gender/session.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("@/modules/shared/api/chat-wonder.service").then((m) => {
        m.chatWonderService.restart().catch(() => {});
      });
    }
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

    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      startListeningRef.current();
    }
  }, [showIdle]);

  // Camera-gated wake on the real mirror. But when the proximity sensor is
  // unavailable (dev machine / no camera), fall back to arming the mic on load
  // so the mirror is still usable hands-free instead of sitting deaf.
  const hasAutoWokeRef = useRef(false);
  useEffect(() => {
    if (hasAutoWokeRef.current || sensorStatus !== "unavailable") return;
    hasAutoWokeRef.current = true;
    const id = setTimeout(() => handleWake(), 400);
    return () => clearTimeout(id);
  }, [sensorStatus, handleWake]);

  // Continuous listening: after each turn returns to idle (and the session is
  // active), re-arm the mic so the mirror keeps catching voice hands-free.
  // Safe because the wake-word gate ignores anything that isn't a "Mirror …"
  // command. Waits for "idle" so it never captures its own TTS while speaking.
  useEffect(() => {
    if (showIdle || voiceState !== "idle") return;
    const id = setTimeout(() => startListeningRef.current(), 600);
    return () => clearTimeout(id);
  }, [voiceState, showIdle]);

  // Handle Proximity Changes
  useEffect(() => {
    if (isPresent) {
      hasBeenPresentRef.current = true;
    }

    if (isPresent && showIdle) {
      // User arrived!
      setTimeout(handleWake, 0);
    } else if (
      !isPresent &&
      !showIdle &&
      sensorStatus !== "unavailable" &&
      hasBeenPresentRef.current
    ) {
      // User walked away! (Only if they were actually present before)
      setShowIdle(true);
      hasGreetedRef.current = false;
      hasBeenPresentRef.current = false;
      // Restart the session completely
      import("@/modules/shared/api/chat-wonder.service").then((m) => {
        m.chatWonderService.restart().finally(() => {
          sessionStorage.clear();
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
        isListening={isListening}
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
                  background: isListening
                    ? "rgba(255,255,255,0.10)"
                    : isSpeaking
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.04)",
                  border: isListening
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
