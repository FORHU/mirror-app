"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import MirrorHeader from "@/components/MirrorHeader";
import { ROUTES } from "@/navigation";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import {
  useOverviewStore,
  adaptGarmentData,
  adaptRemoteOutfitsToTiles,
  adaptCosmeticsData,
} from "@/modules/overview";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { outfitService } from "@/modules/shared/api/outfit.service";
import { cosmeticsService } from "@/modules/shared/api/cosmetics.service";
import { useWeather } from "@/modules/shared/hooks/useWeather";
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
    prompts: [
      "Give me a complete style and wellness briefing for today — outfit and skincare.",
      "What should I wear and how should I prep my skin for today?",
      "Style me for today — outfit recommendation and a matching skincare routine.",
      "Plan my look and skincare for today based on the weather.",
      "Give me today's complete style guide — from outfit to skincare.",
      "What's my best outfit and skincare routine for today?",
      "Help me put together a full look for today, including skincare.",
      "Today's style brief: recommend an outfit and a quick skincare routine.",
      "Dress me for today and suggest the right skincare for the conditions.",
      "Create a full daily look for me — clothes and skin routine included.",
    ],
    gradient: "from-blue-500/20 to-cyan-500/5",
    border: "border-blue-500/20",
  },
  {
    id: "formal",
    title: "Special Event",
    description: "Plan my full look and prep",
    icon: "🥂",
    prompts: [
      "I have a special event to attend — plan my full look and skincare prep.",
      "Help me dress for a special occasion with a complete outfit and skin prep.",
      "I'm attending a special event — suggest a standout look and skincare routine.",
      "Plan an elegant look for my upcoming event, including skincare preparation.",
      "I need an outfit and skin prep for a special occasion — make it memorable.",
      "Style me for a special event — from outfit to pre-event skincare.",
      "Give me a full event look: the perfect outfit and a glowing skincare routine.",
      "I have a special occasion — what should I wear and how should I prep my skin?",
      "Create a polished event outfit and skincare plan for my upcoming occasion.",
      "I'm going to a special event — dress me to impress with the right skincare too.",
    ],
    gradient: "from-purple-500/20 to-pink-500/5",
    border: "border-purple-500/20",
  },
  {
    id: "casual",
    title: "Casual & Comfy",
    description: "Relaxed weekend look",
    icon: "🛋️",
    prompts: [
      "Build me a casual, comfortable outfit and skincare routine.",
      "I want a relaxed, cozy look for today — outfit and easy skincare.",
      "Style me for a chill day — casual outfit and a simple skincare routine.",
      "Give me a laid-back weekend look with a matching skincare routine.",
      "I need a comfortable outfit and low-maintenance skincare for a relaxed day.",
      "Create an effortless casual look for me with a basic skincare routine.",
      "Style me comfortably — easygoing outfit and a minimalist skincare routine.",
      "What's a great casual look and skincare routine for a relaxed day at home?",
      "I'm keeping it chill today — suggest a comfy outfit and simple skincare.",
      "Put together a soft, cozy outfit and a gentle skincare routine for my day off.",
    ],
    gradient: "from-emerald-500/20 to-teal-500/5",
    border: "border-emerald-500/20",
  },
  {
    id: "office",
    title: "Office Ready",
    description: "Professional workwear",
    icon: "💼",
    prompts: [
      "Suggest a professional outfit and skincare for work.",
      "Help me dress for the office — polished outfit and work-appropriate skincare.",
      "I need a sharp workwear look and a professional skincare routine for the office.",
      "What should I wear to work today, and what's the right skincare routine?",
      "Plan my office look — business-appropriate outfit and a clean skincare routine.",
      "Style me for a productive workday — professional attire and neat skincare.",
      "Give me a work-ready outfit and a quick morning skincare routine.",
      "I have meetings today — suggest a confident look and professional skincare.",
      "Create a polished office look and skincare routine for my workday.",
      "Dress me for success at work with the right outfit and skincare approach.",
    ],
    gradient: "from-amber-500/20 to-orange-500/5",
    border: "border-amber-500/20",
  },
];

export default function AIAssistantPage() {
  const router = useRouter();
  const isPresent = useMirrorStore((s) => s.isPresent);
  const setAssistantIdle = useMirrorStore((s) => s.setAssistantIdle);
  const skinAnalysisResult = useMirrorStore((s) => s.skinAnalysisResult);
  const { weather } = useWeather();

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
    if (isPresent && showIdle) queueMicrotask(() => setShowIdle(false));
  }, [isPresent, showIdle]);

  const handleScenarioClick = useCallback(
    (prompt: string) => {
      // Pre-fill the overview store so tiles show loading skeletons immediately
      // and outline hydration is blocked while the real data is in flight.
      const store = useOverviewStore.getState();
      store.setGreeting("Pulling that together for you…");
      store.startOutfits();
      store.startCosmetics();
      store.setPendingPrompt(prompt);

      router.push(ROUTES.OVERVIEW);

      // Fetch fashion + cosmetics in the background.
      // Strategy: one primary "overview" call that should return both domains.
      // If either is missing, fire a targeted fallback call for that domain only.
      void (async () => {
        const call = async (
          payload: Parameters<typeof chatWonderService.message>[0],
        ) => {
          try {
            return await chatWonderService.message(payload);
          } catch (err) {
            if (err instanceof Error && err.message.includes("HTTP 409")) {
              await chatWonderService.restart();
              return chatWonderService.message(payload);
            }
            throw err;
          }
        };

        try {
          // Primary call — expects both garment_data and cosmetics_data back
          const primary = await call({
            input: `[stylist] Plan: ${prompt}`,
            pageMode: "overview" as const,
            ...(weather
              ? { weather: weather as unknown as Record<string, unknown> }
              : {}),
            ...(skinAnalysisResult ? { skinAnalysis: skinAnalysisResult } : {}),
          });

          // If a domain is missing, fire a targeted fallback for that domain only
          let rawGarmentData = primary.garment_data as Record<
            string,
            unknown
          > | null;
          if (!rawGarmentData) {
            const fallback = await call({
              input: `[stylist] Outfit: ${prompt}`,
              pageMode: "garment" as const,
              ...(weather
                ? { weather: weather as unknown as Record<string, unknown> }
                : {}),
            });
            rawGarmentData = fallback.garment_data as Record<
              string,
              unknown
            > | null;
          }

          let rawCosmeticsData = primary.cosmetics_data as Record<
            string,
            unknown
          > | null;
          if (!rawCosmeticsData) {
            const fallback = await call({
              input: `[stylist] Skincare: ${prompt}`,
              pageMode: "cosmetics" as const,
              ...(skinAnalysisResult
                ? { skinAnalysis: skinAnalysisResult }
                : {}),
            });
            rawCosmeticsData = fallback.cosmetics_data as Record<
              string,
              unknown
            > | null;
          }

          const garmentQuery =
            typeof rawGarmentData?.query === "string"
              ? rawGarmentData.query
              : null;
          const cosmeticsQuery =
            typeof rawCosmeticsData?.query === "string"
              ? rawCosmeticsData.query
              : null;

          // Both DB fetches run in parallel once we have the queries
          const fashionFetch = (async () => {
            if (garmentQuery) {
              const fetched = await outfitService.getByQuery(garmentQuery);
              const result = adaptRemoteOutfitsToTiles(fetched);
              if (result.garments.length > 0 || result.outfits.length > 0)
                return result;
              return adaptGarmentData({ ...rawGarmentData, query: undefined });
            }
            return adaptGarmentData(rawGarmentData);
          })();

          const cosmeticsFetch = (async () => {
            if (cosmeticsQuery) {
              const fetched = await cosmeticsService.getByQuery(cosmeticsQuery);
              return adaptCosmeticsData(fetched);
            }
            return adaptCosmeticsData(rawCosmeticsData);
          })();

          const [fashion, cosmetics] = await Promise.all([
            fashionFetch,
            cosmeticsFetch,
          ]);

          const s = useOverviewStore.getState();
          s.setOutfits(fashion.outfits);
          s.setCosmetics(cosmetics);
        } catch {
          const s = useOverviewStore.getState();
          s.setOutfits([]);
          s.setCosmetics([]);
        }
      })();
    },
    [router, weather, skinAnalysisResult],
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
                    onClick={() => handleScenarioClick(scenario.prompts[Math.floor(Math.random() * scenario.prompts.length)])}
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
