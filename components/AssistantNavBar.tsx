"use client";

import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";

function NavButton({ label, route }: { label: string; route: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onTouchStart={() => router.push(route)}
      onClick={() => router.push(route)}
      className="pointer-events-auto px-4 py-2 rounded-2xl text-[11px] font-medium text-white/50 uppercase tracking-[0.18em] transition-colors hover:text-white/85 hover:bg-white/5 active:bg-white/10"
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
  const { isListening, isProcessing, isSpeaking } = useVoiceContext();
  if (isProcessing || isSpeaking) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-[9990] flex justify-center px-6 pointer-events-none">
      <div
        className="pointer-events-auto relative flex items-center w-[480px] max-w-[calc(100vw-2rem)] h-20 px-5 rounded-[34px]"
        style={{
          background: "rgba(16,18,24,0.88)",
          border: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex-1 flex items-center justify-around">
          <NavButton label="Fashion" route={ROUTES.AI_RECOMMENDATION_FASHION} />
          <NavButton label="Cosmetics" route={ROUTES.AI_RECOMMENDATION_COSMETIC} />
          <NavButton label="Map" route={ROUTES.MAP} />
          <NavButton label="Overview" route={ROUTES.OVERVIEW} />
        </div>
      </div>
    </div>
  );
}
