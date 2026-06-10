"use client";

import { useRouter, usePathname } from "next/navigation";
import { ROUTES } from "@/navigation";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useOverviewStore } from "@/modules/overview";
import { motion } from "motion/react";
import { Mic, ShoppingBag, Sparkles, Map, LayoutGrid, type LucideIcon } from "lucide-react";

function NavButton({
  label,
  icon: Icon,
  route,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  route: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname.startsWith(route);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && router.push(route)}
      style={{ touchAction: "manipulation" }}
      className={`pointer-events-auto flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-colors ${
        disabled
          ? "text-white/20 cursor-not-allowed"
          : isActive
            ? "text-white cursor-pointer"
            : "text-white/50 hover:text-white/80 hover:bg-white/5 active:bg-white/10 cursor-pointer"
      }`}
    >
      <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

const BAR_SCALES = [0.45, 0.8, 1.0, 0.8, 0.45];

function SoundBars() {
  return (
    <div className="flex items-end justify-center gap-0.75 pointer-events-none" style={{ height: 22 }}>
      {BAR_SCALES.map((scale, i) => (
        <motion.div
          key={i}
          className="w-0.75 rounded-full bg-emerald-400"
          style={{ height: Math.round(scale * 22) }}
          animate={{ scaleY: [scale, 1.0, scale * 0.5, 1.0, scale] }}
          transition={{
            duration: 0.85,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

export default function AssistantNavBar() {
  const { isProcessing, isSpeaking, isListening, toggle } = useVoiceContext();

  const overviewHasData = useOverviewStore(
    (s) =>
      s.outfits.status === "ready" ||
      s.cosmetics.status === "ready" ||
      s.map.status === "ready" ||
      s.skinAnalysis.status === "ready",
  );

  if (isProcessing || isSpeaking) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-[9990] flex justify-center px-6 pointer-events-none">
      <div
        className="pointer-events-auto relative flex items-center w-[540px] max-w-[calc(100vw-2rem)] h-20 px-5 rounded-[34px]"
        style={{
          background: "rgba(16,18,24,0.88)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex-1 min-w-0 flex items-center justify-around pr-2">
          <NavButton label="Fashion" icon={ShoppingBag} route={ROUTES.AI_RECOMMENDATION_FASHION} />
          <NavButton label="Cosmetics" icon={Sparkles} route={ROUTES.AI_RECOMMENDATION_COSMETIC} />
        </div>

        {/* center mic button — integrated into the bar */}
        <motion.button
          type="button"
          onClick={toggle}
          aria-label="Voice assistant"
          className="shrink-0 flex items-center justify-center cursor-pointer"
          style={{
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: isListening
              ? "rgba(5,20,12,0.92)"
              : "rgba(30,32,44,0.9)",
            border: isListening
              ? "2px solid rgba(34,197,94,0.7)"
              : "2px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
            touchAction: "manipulation",
          }}
          animate={
            isListening
              ? {
                  boxShadow: [
                    "0 0 10px rgba(34,197,94,0.25)",
                    "0 0 22px rgba(34,197,94,0.6)",
                    "0 0 10px rgba(34,197,94,0.25)",
                  ],
                }
              : { boxShadow: "0 4px 20px rgba(0,0,0,0.45)" }
          }
          transition={{
            boxShadow: isListening
              ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 },
            scale: { duration: 0.12 },
          }}
          whileTap={{ scale: 0.92 }}
        >
          {isListening ? (
            <SoundBars />
          ) : (
            <Mic className="w-6 h-6 text-white/90" />
          )}
        </motion.button>

        <div className="flex-1 min-w-0 flex items-center justify-around pl-2">
          <NavButton label="Map" icon={Map} route={ROUTES.MAP} />
          <NavButton label="Overview" icon={LayoutGrid} route={ROUTES.OVERVIEW} disabled={!overviewHasData} />
        </div>
      </div>
    </div>
  );
}
