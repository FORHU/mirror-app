"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import MirrorHeader from "@/components/MirrorHeader";
import { QuickResponseChips, getToday, nextWeekday } from "@/components/QuickResponseChips";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";
import AssistantNavBar from "@/components/AssistantNavBar";
import { useProximitySensor } from "@/modules/shared/hooks/useProximitySensor";
import { useRouter } from "next/navigation";
import { performRestart } from "@/modules/shared/voice/sessionCommands";
import {
  useOverviewStore,
  adaptGarmentData,
  adaptMapsData,
  CameraDisclaimer,
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

const ASSISTANT_GREETINGS = [
  "Hi there! Looking for an outfit, beauty tips, or places to explore?",
  "Hello! How can I help with your style today?",
  "Hey there! Ready to discover your next look?",
  "Good to see you! What are we styling today?",
  "Welcome! Need outfit inspiration, beauty advice, or local recommendations?",
  "Hi! Let's find something that suits your style.",
  "Hello there! Looking for fashion, cosmetics, or nearby trends?",
  "Hey! What kind of look are you going for today?",
  "Welcome back! Ready for a style refresh?",
  "Hi there! What would you like help with: outfits, beauty, or places?",
  "Hello! Let's create a look you'll love.",
  "Hey there! Looking for the perfect outfit today?",
  "Hi! Need help choosing cosmetics that fit your style?",
  "Welcome! Want recommendations tailored to your preferences?",
  "Hello! Let's discover your next favorite look.",
  "Good to see you! What occasion are you dressing for today?",
  "Hi there! Looking for beauty products that match your needs?",
  "Hello! Need inspiration for your next outfit?",
  "Hey! Let's find styles that work for you.",
  "Welcome back! Want help building a complete look?",
  "Hi! Curious about the latest fashion trends?",
  "Hello there! Searching for beauty essentials?",
  "Hey! Need outfit recommendations for an event?",
  "Welcome! Let's explore looks that fit your vibe.",
  "Hi there! Looking for something casual, formal, or trendy?",
  "Hello! Want personalized style suggestions?",
  "Hey there! Let's find the perfect match for your wardrobe.",
  "Good to see you! Need help completing your outfit?",
  "Hi! Looking for cosmetics that complement your features?",
  "Hello! Ready to elevate your style?",
  "Welcome back! Let's discover new beauty favorites.",
  "Hey! Need recommendations for your next shopping trip?",
  "Hi there! What fashion goal can I help with today?",
  "Hello! Let's put together a look you'll feel confident in.",
  "Hey there! Searching for beauty inspiration?",
  "Welcome! Need help choosing between products?",
  "Hi! Looking for nearby beauty or fashion spots?",
  "Hello! Want recommendations based on your style preferences?",
  "Hey! Let's explore fashion, beauty, and lifestyle together.",
  "Good to see you! What's your style mood today?"
];

export default function AIAssistantPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceStateRef = useRef<string>("idle");
  const submitTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  const startListeningRef = useRef<() => void>(() => {});

  const setGarments = useOverviewStore((s) => s.setGarments);
  const setOutfits = useOverviewStore((s) => s.setOutfits);
  const setMap = useOverviewStore((s) => s.setMap);
  const setSkinAnalysisResult = useMirrorStore((s) => s.setSkinAnalysisResult);
  const setSkinCaptureUrl = useMirrorStore((s) => s.setSkinCaptureUrl);
  const setAssistantIdle = useMirrorStore((s) => s.setAssistantIdle);

  const [showIdle, setShowIdle] = useState(true);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [activeGreeting, setActiveGreeting] = useState(ASSISTANT_GREETINGS[0]);
  const hasGreetedRef = useRef(false);
  const hasBeenPresentRef = useRef(false);
  const hasCapturedSkinRef = useRef(false);

  const pageContext = useMemo(
    () => ({
      route: ROUTES.WELCOME,
      pageName: "AI Assistant",
      mode: "overview" as const,
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
    isListening,
    isProcessing,
    isSpeaking,
    chatHistory,
    submitText,
    startListening,
    speakText,
  } = useVoiceContext();

  const {
    isPresent,
    videoRef,
    status: sensorStatus,
    captureFrame,
  } = useProximitySensor({
    intervalMs: 1000,
    missesUntilExit: 3,
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

  // Tell the shared mic to hide while the idle welcome screen is up (so a tap
  // can't bypass the spoken greeting), and clear the flag on unmount.
  useEffect(() => {
    setAssistantIdle(showIdle);
  }, [showIdle, setAssistantIdle]);
  useEffect(() => () => setAssistantIdle(false), [setAssistantIdle]);

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

  const chooseGreeting = useCallback(() => {
    return ASSISTANT_GREETINGS[
      Math.floor(Math.random() * ASSISTANT_GREETINGS.length)
    ];
  }, []);

  const playGreeting = useCallback(
    (greeting = activeGreeting) => {
      hasGreetedRef.current = true;
      setActiveGreeting(greeting);
      void speakText(greeting).finally(() => {
        startListeningRef.current();
      });
    },
    [activeGreeting, speakText],
  );

  const handleWake = useCallback((shouldSpeak = true) => {
    if (!showIdle) return;
    setShowIdle(false);

    if (!hasGreetedRef.current) {
      const greeting = chooseGreeting();
      setActiveGreeting(greeting);
      if (shouldSpeak) playGreeting(greeting);
    }
  }, [chooseGreeting, playGreeting, showIdle]);

  // Camera-gated wake on the real mirror. But when the proximity sensor is
  // unavailable (dev machine / no camera), fall back to arming the mic on load
  // so the mirror is still usable hands-free instead of sitting deaf.
  const hasAutoWokeRef = useRef(false);
  useEffect(() => {
    if (hasAutoWokeRef.current || sensorStatus !== "unavailable") return;
    hasAutoWokeRef.current = true;
    const id = setTimeout(() => handleWake(false), 400);
    return () => clearTimeout(id);
  }, [sensorStatus, handleWake]);

  // Handle Proximity Changes
  useEffect(() => {
    if (isPresent) {
      hasBeenPresentRef.current = true;
    }

    if (isPresent && showIdle) {
      // User arrived (detected by camera) — greet out loud, same initial audio
      // as the tap path, then the welcome flow continues into listening.
      setTimeout(() => handleWake(true), 0);
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
      performRestart(router).finally(() => {
        window.location.reload();
      });
    }
  }, [isPresent, showIdle, handleWake, sensorStatus, router]);

  const status = isListening
    ? "Listening"
    : isProcessing
      ? "Thinking"
      : isSpeaking
        ? "Speaking"
        : "Idle";

  const latest = chatHistory[chatHistory.length - 1];
  const displayUser = transcript || latest?.user || "";
  const displayReply = error || reply || latest?.assistant || activeGreeting;

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      <MirrorHeader />

      <AnimatePresence mode="wait">
        {showIdle ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col items-center justify-center px-12 cursor-pointer relative"
            onClick={() => handleWake(true)}
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

            <div className="absolute bottom-6 inset-x-0 px-6 z-10">
              <CameraDisclaimer />
            </div>
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
                      className={`font-thin leading-[1.4] tracking-tight overflow-y-auto pr-2 ${
                        error ? "text-red-300/75" : "text-white/90"
                      }`}
                      style={{
                        fontSize: "clamp(1.125rem, 2.5vw, 1.5rem)",
                        maxHeight: "45vh",
                      }}
                    >
                      {displayReply}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ambient state indicator — the mic control itself is the shared
                center-bottom GlobalVoiceOverlay button; here we only echo state. */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-24">
              <p className="text-white/50 text-[10px] uppercase tracking-[0.4em] font-light">
                {status}
              </p>
              {sensorStatus === "unavailable" && (
                <p className="text-white/20 text-[9px] tracking-wide">
                  Camera unavailable
                </p>
              )}
            </div>

            {/* Bottom nav — flanks the shared center-bottom mic:
                Fashion · Cosmetics · [mic] · Map · Overview */}
            <AssistantNavBar />

            {/* Quick Response Chips */}
            <QuickResponseChips
              prompts={[
                `What should I wear today? It's ${getToday()} and I want to look put-together.`,
                `I have a special event this ${nextWeekday(5)} — suggest a complete outfit for me.`,
                "Recommend skincare products tailored to my skin type and current condition.",
                "What's nearby worth visiting — restaurants, cafes, or interesting spots around me?",
                "Give me a full overview of outfit options, skincare picks, and places to go today.",
              ]}
            />

            {/* reserves room so the chips clear the fixed bottom nav bar */}
            <div ref={bottomRef} className="h-24 shrink-0" />
          </motion.main>
        )}
      </AnimatePresence>

      {/* Camera Debug Overlay */}
      <div className="fixed top-4 right-4 z-999 flex flex-col items-end gap-2 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
          <span className="text-white/60 text-[10px] uppercase tracking-wider font-medium">
            Camera Debug
          </span>
          <div
            className={`w-2 h-2 rounded-full ${isPresent ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-red-500/50 animate-pulse"}`}
          />
        </div>
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black shadow-2xl w-48 aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-contain transform -scale-x-100"
          />
          {/* Simulated bounding box when face is detected */}
          {isPresent && (
            <div className="absolute inset-0 border-2 border-green-500/50 m-4 rounded shadow-[inset_0_0_10px_rgba(34,197,94,0.2)] flex items-center justify-center">
              <div className="w-1/2 h-1/2 border border-green-400/30 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
