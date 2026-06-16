"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import type { SkinAnalysis } from "@/modules/shared/api/cosmetics.service";
import MirrorHeader from "@/components/MirrorHeader";
import { ROUTES } from "@/navigation";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
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
    metaCategory: "Casual",
    gradient: "from-blue-500/20 to-cyan-500/5",
    border: "border-blue-500/20",
    prompts: [
      "Style me for today! Give me a casual, relaxed look and matching skincare.",
      "What should I wear today? I want a comfortable daily outfit and some beauty product recommendations.",
      "Put together a casual daily look for me, along with a simple skincare routine.",
    ],
  },
  {
    id: "formal",
    title: "Special Event",
    description: "Plan my full look and prep",
    icon: "🥂",
    metaCategory: "Formal",
    gradient: "from-purple-500/20 to-pink-500/5",
    border: "border-purple-500/20",
    prompts: [
      "I'm going to a special event! Recommend a stunning formal outfit and a prep routine.",
      "Plan my full formal look for a big event tonight, including beauty and skincare.",
      "I need an elegant formal outfit and some matching cosmetics to get ready for a special occasion.",
    ],
  },
  {
    id: "casual",
    title: "Casual & Comfy",
    description: "Relaxed weekend look",
    icon: "🛋️",
    metaCategory: "Athleisure",
    gradient: "from-emerald-500/20 to-teal-500/5",
    border: "border-emerald-500/20",
    prompts: [
      "I just want to be cozy. Recommend a comfortable athleisure outfit and some relaxing skincare.",
      "Give me a relaxed weekend look using athleisure wear, plus some beauty recommendations.",
      "Style me in a comfy athleisure fit for lounging, and suggest some light skincare.",
    ],
  },
  {
    id: "office",
    title: "Office Ready",
    description: "Professional workwear",
    icon: "💼",
    metaCategory: "SmartCasual",
    gradient: "from-amber-500/20 to-orange-500/5",
    border: "border-amber-500/20",
    prompts: [
      "I need a professional Smart Casual outfit for the office today, along with work-appropriate beauty products.",
      "Style me for work! Recommend a smart casual office outfit and a fresh skincare routine.",
      "Put together an office-ready smart casual look for me and suggest some matching cosmetics.",
    ],
  },
];

const MOCK_PROFILES: SkinAnalysis[] = [
  {
    skinType: "OILY",
    concerns: ["acne-prone", "brightening"],
    hydrationPct: 42,
    oilinessPct: 78,
    skinTone: "medium",
    id: "mock_skin_oily",
    routineTip: "Use lightweight, oil-free formulas.",
    recommendations: [],
  },
  {
    skinType: "DRY",
    concerns: ["flakiness", "fine lines"],
    hydrationPct: 24,
    oilinessPct: 15,
    skinTone: "light",
    id: "mock_skin_dry",
    routineTip: "Prioritize rich, hydrating creams.",
    recommendations: [],
  },
  {
    skinType: "NORMAL",
    concerns: ["maintenance", "dullness"],
    hydrationPct: 65,
    oilinessPct: 45,
    skinTone: "tan",
    id: "mock_skin_normal",
    routineTip: "Maintain balance with gentle cleansing.",
    recommendations: [],
  },
  {
    skinType: "SENSITIVE",
    concerns: ["redness", "soothing"],
    hydrationPct: 55,
    oilinessPct: 30,
    skinTone: "fair",
    id: "mock_skin_sensitive",
    routineTip: "Avoid harsh fragrances and exfoliants.",
    recommendations: [],
  },
];

export default function AIAssistantPage() {
  const router = useRouter();
  const isPresent = useMirrorStore((s) => s.isPresent);
  const showIdle = useMirrorStore((s) => s.assistantIdle);
  const setAssistantIdle = useMirrorStore((s) => s.setAssistantIdle);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [taglineIndex, setTaglineIndex] = useState(0);
  const [activeGender, setActiveGender] = useState<"MALE" | "FEMALE" | null>(
    null,
  );
  const [pendingScenario, setPendingScenario] = useState<
    (typeof SCENARIOS)[number] | null
  >(null);

  // Tell the shared layout we're no longer idle when we leave the page
  useEffect(() => {
    return () => setAssistantIdle(false);
  }, [setAssistantIdle]);

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
    if (showIdle) setAssistantIdle(false);
  }, [showIdle, setAssistantIdle]);

  useEffect(() => {
    if (isPresent && showIdle) queueMicrotask(() => setAssistantIdle(false));
  }, [isPresent, showIdle, setAssistantIdle]);

  const runScenario = useCallback(
    (
      scenario: (typeof SCENARIOS)[number],
      gender: "MALE" | "FEMALE" | null,
    ) => {
      const store = useOverviewStore.getState();
      store.setGreeting("Pulling that together for you…");
      const randomPrompt =
        scenario.prompts[Math.floor(Math.random() * scenario.prompts.length)];
      store.setPendingPrompt(`[stylist] ${randomPrompt}`);
      store.setPendingCategory("metaCategory=" + scenario.metaCategory);
      store.setPendingGender(gender);

      // Globally mock skin analysis if the camera hasn't populated it yet
      const mirrorStore = useMirrorStore.getState();
      if (!mirrorStore.skinAnalysisResult) {
        const randomProfile =
          MOCK_PROFILES[Math.floor(Math.random() * MOCK_PROFILES.length)];
        mirrorStore.setSkinAnalysisResult(randomProfile);
      }

      router.push(ROUTES.OVERVIEW);
    },
    [router],
  );

  const handleScenarioClick = useCallback(
    (scenario: (typeof SCENARIOS)[number]) => {
      setPendingScenario(scenario);
    },
    [],
  );

  const handleGenderConfirm = useCallback(
    (gender: "MALE" | "FEMALE") => {
      setActiveGender(gender);
      updateUser({ gender });
      const scenario = pendingScenario;
      setPendingScenario(null);
      if (scenario) runScenario(scenario, gender);
    },
    [pendingScenario, runScenario, updateUser],
  );

  const handleGenderSkip = useCallback(() => {
    const scenario = pendingScenario;
    setPendingScenario(null);
    if (scenario) runScenario(scenario, activeGender);
  }, [pendingScenario, runScenario, activeGender]);

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
                    onClick={() => handleScenarioClick(scenario)}
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

      {/* Gender selection dialog */}
      <AnimatePresence>
        {pendingScenario && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(12px)",
            }}
            onClick={() => setPendingScenario(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex flex-col items-center gap-8 px-10 py-12 rounded-3xl"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                backdropFilter: "blur(20px)",
                minWidth: "320px",
              }}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-white/40 text-xs uppercase tracking-[0.3em]">
                  {pendingScenario.icon} {pendingScenario.title}
                </p>
                <h2 className="text-3xl font-thin text-white tracking-tight">
                  Who are we styling?
                </h2>
              </div>

              <div className="flex gap-4 w-full">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGenderConfirm(g)}
                    className="flex-1 py-4 rounded-2xl text-base font-light tracking-wide transition-all duration-200"
                    style={{
                      background:
                        activeGender === g
                          ? "rgba(255,255,255,0.18)"
                          : "rgba(255,255,255,0.06)",
                      border:
                        activeGender === g
                          ? "1px solid rgba(255,255,255,0.35)"
                          : "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                    }}
                  >
                    {g === "MALE" ? "Male" : "Female"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGenderSkip}
                className="text-white/30 text-xs uppercase tracking-[0.25em] hover:text-white/55 transition-colors"
              >
                Skip
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
