"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import MirrorHeader from "@/components/MirrorHeader";
import { ROUTES } from "@/navigation";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useOverviewStore } from "@/modules/overview";
import { cn } from "../../modules/shared/utils";

const TAGLINES = [
  "Personalized for every reflection.",
  "Smart style. Seamless discovery.",
  "Designed around you.",
  "Your style, beautifully understood.",
  "See more. Discover more. Be more.",
  "Style and Beauty. Perfectly Connected.",
  "Discover your signature look.",
  "Where beauty meets elegance.",
  "Your guide to style, beauty, and beyond.",
  "Elevate your look beautifully.",
  "Look Good. Feel Confident.",
  "Fashion and Beauty—All in One Reflection.",
  "Find Your Style. Express Yourself.",
  "Curated for your look. Designed for you.",
  "Beauty from every angle.",
];

const SCENARIOS = [
  {
    id: "daily",
    title: "Style me for today",
    description: "Daily outfit and skincare routine",
    icon: "🌤️",
    prompt:
      "Give me a complete style and wellness briefing for today — outfit and skincare.",
    gradient: "from-blue-500/20 to-cyan-500/5",
    border: "border-blue-500/20",
  },
  {
    id: "formal",
    title: "Special Event",
    description: "Plan my full look and prep",
    icon: "🥂",
    prompt:
      "I have a special event to attend — plan my full look and skincare prep.",
    gradient: "from-purple-500/20 to-pink-500/5",
    border: "border-purple-500/20",
  },
  {
    id: "casual",
    title: "Casual & Comfy",
    description: "Relaxed weekend look",
    icon: "🛋️",
    prompt: "Build me a casual, comfortable outfit and skincare routine.",
    gradient: "from-emerald-500/20 to-teal-500/5",
    border: "border-emerald-500/20",
  },
  {
    id: "office",
    title: "Office Ready",
    description: "Professional workwear",
    icon: "💼",
    prompt: "Suggest a professional outfit and skincare for work.",
    gradient: "from-amber-500/20 to-orange-500/5",
    border: "border-amber-500/20",
  },
];

export default function AIAssistantPage() {
  const router = useRouter();
  const isPresent = useMirrorStore((s) => s.isPresent);
  const setAssistantIdle = useMirrorStore((s) => s.setAssistantIdle);

  const [showIdle, setShowIdle] = useState(true);
  const [taglineIndex, setTaglineIndex] = useState(0);

  // Tell the shared layout we're idle so it can hide global elements if needed
  useEffect(() => {
    setAssistantIdle(showIdle);
    return () => setAssistantIdle(false);
  }, [showIdle, setAssistantIdle]);

  // Dev console helper: call window.__resetSession() to restart ChatWonder manually
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    import("@/modules/shared/api/chat-wonder.service").then((m) => {
      (window as Window & { __resetSession?: () => void }).__resetSession =
        () =>
          m.chatWonderService
            .restart()
            .then(() => console.info("[dev] Session reset"));
    });
    return () => {
      delete (window as Window & { __resetSession?: () => void })
        .__resetSession;
    };
  }, []);

  // Cycle taglines every 4s while idle screen is visible
  useEffect(() => {
    if (!showIdle) return;
    const id = setInterval(
      () => setTaglineIndex((i) => (i + 1) % TAGLINES.length),
      4000,
    );
    return () => clearInterval(id);
  }, [showIdle]);

  const handleWake = useCallback(() => {
    if (showIdle) setShowIdle(false);
  }, [showIdle]);

  // Auto-wake when the proximity sensor detects someone stepping up
  useEffect(() => {
    if (isPresent && showIdle) handleWake();
  }, [isPresent, showIdle, handleWake]);

  const setPendingPrompt = useOverviewStore((s) => s.setPendingPrompt);

  const handleScenarioClick = useCallback(
    (prompt: string) => {
      setPendingPrompt(prompt);
      router.push(ROUTES.OVERVIEW);
    },
    [router, setPendingPrompt],
  );

  return (
    <div className="w-screen h-screen bg-canvas flex flex-col overflow-hidden relative">
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
            onClick={handleWake}
          >
            {/* Background Video Loop */}
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
                  {TAGLINES[taglineIndex]}
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
              <div className="rounded-full border border-white/20 w-12 h-12 flex items-center justify-center" />
              <p className="text-[9px] uppercase tracking-[0.5em] text-white/25 font-light">
                Tap to start
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.main
            key="hub"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-h-0 flex flex-col px-10 pt-16 pb-28 relative z-10"
          >
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full justify-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-center mb-12"
              >
                <h1 className="text-4xl font-thin text-white mb-3 tracking-tight">
                  What are we styling today?
                </h1>
                <p className="text-white/40 text-sm tracking-wide font-light uppercase">
                  Select a scenario to generate your look
                </p>
              </motion.div>

              <motion.div
                className="grid grid-cols-2 gap-6 mt-8"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 },
                  },
                }}
              >
                {SCENARIOS.map((scenario) => (
                  <motion.button
                    key={scenario.id}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 },
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleScenarioClick(scenario.prompt)}
                    className={cn(
                      "relative group overflow-hidden rounded-[32px] text-left p-8",
                      "border bg-black/40 backdrop-blur-xl transition-all duration-500",
                      scenario.border,
                      "hover:shadow-2xl hover:shadow-white/5",
                    )}
                  >
                    {/* Hover Gradient Background */}
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                        scenario.gradient,
                      )}
                    />

                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div className="text-4xl mb-6 bg-white/5 w-16 h-16 rounded-full flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-colors">
                        {scenario.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-light text-white mb-2 tracking-tight group-hover:text-white transition-colors">
                          {scenario.title}
                        </h2>
                        <p className="text-white/50 text-sm font-light">
                          {scenario.description}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
