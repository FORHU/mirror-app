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
      className="pointer-events-auto px-5 py-2 rounded-full text-[11px] font-light text-white/55 border border-white/15 uppercase tracking-widest transition-colors active:bg-white/10 hover:bg-white/5"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Fixed bottom nav for the assistant, flanking the shared center-bottom mic:
 *
 *   Fashion · Cosmetics · [mic] · Map · Overview
 *
 * Two equal flex-1 sides hug a centered gap, so the gap (and the GlobalVoiceOverlay
 * mic that floats in it) stays dead-center regardless of differing button widths.
 * Hides itself while the mic morphs into its wide waveform (processing/speaking)
 * so the two never collide.
 */
export default function AssistantNavBar() {
  const { isProcessing, isSpeaking } = useVoiceContext();
  if (isProcessing || isSpeaking) return null;

  return (
    <div className="fixed bottom-6 inset-x-0 z-[9990] h-16 flex items-center px-6 pointer-events-none">
      <div className="flex-1 flex items-center justify-end gap-3">
        <NavButton label="Fashion" route={ROUTES.AI_RECOMMENDATION_FASHION} />
        <NavButton label="Cosmetics" route={ROUTES.AI_RECOMMENDATION_COSMETIC} />
      </div>
      <div className="w-20 shrink-0" aria-hidden />
      <div className="flex-1 flex items-center justify-start gap-3">
        <NavButton label="Map" route={ROUTES.MAP} />
        <NavButton label="Overview" route={ROUTES.OVERVIEW} />
      </div>
    </div>
  );
}
