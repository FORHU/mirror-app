"use client";

import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useOverviewStore } from "@/modules/overview";

function NavButton({
  label,
  route,
  disabled,
}: {
  label: string;
  route: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={() => !disabled && router.push(route)}
      onClick={() => !disabled && router.push(route)}
      className={`pointer-events-auto whitespace-nowrap px-3 py-2 rounded-2xl text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
        disabled
          ? "text-white/20 cursor-not-allowed"
          : "text-white/50 hover:text-white/85 hover:bg-white/5 active:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Fixed bottom nav for the assistant. A single rounded, glassy bar whose center
 * gap holds the shared GlobalVoiceOverlay mic (the raised green control):
 *
 *   [ Fashion · Cosmetics ·  (mic)  · Map · Overview ]
 *                LISTENING…
 *
 * Two equal flex-1 sides hug a centered gap so the gap — and the viewport-centered
 * mic floating in it — stays dead-center regardless of button widths. The bar
 * hides while the mic morphs into its wide waveform (processing/speaking) so the
 * two never collide.
 */
export default function AssistantNavBar() {
  const { isProcessing, isSpeaking } = useVoiceContext();

  // Overview is disabled until at least one tile has been populated with data.
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
          <NavButton label="Fashion" route={ROUTES.AI_RECOMMENDATION_FASHION} />
          <NavButton
            label="Cosmetics"
            route={ROUTES.AI_RECOMMENDATION_COSMETIC}
          />
        </div>

        {/* center gap — the global 64px mic floats here (viewport center);
            kept wide enough that the inner buttons never slide under it */}
        <div className="w-24 shrink-0" aria-hidden />

        {/* right group — mirrors the left so Map keeps the same clearance from
            the mic that Cosmetics does */}
        <div className="flex-1 min-w-0 flex items-center justify-around pl-2">
          <NavButton label="Map" route={ROUTES.MAP} />
          <NavButton
            label="Overview"
            route={ROUTES.OVERVIEW}
            disabled={!overviewHasData}
          />
        </div>
      </div>
    </div>
  );
}
