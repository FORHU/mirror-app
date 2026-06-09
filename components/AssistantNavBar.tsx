"use client";

import { useRouter, usePathname } from "next/navigation";
import { ROUTES } from "@/navigation";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";

const APP_ROUTES = new Set<string>(Object.values(ROUTES));

function NavButton({ label, route }: { label: string; route: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === route;

  return (
    <button
      type="button"
      onTouchStart={() => router.push(route)}
      onClick={() => router.push(route)}
      className={`pointer-events-auto relative px-4 py-2.5 rounded-2xl text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
        isActive
          ? "text-white"
          : "text-white/45 hover:text-white/80 hover:bg-white/5 active:bg-white/10"
      }`}
    >
      {label}
      {isActive && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4fc3f7]" />
      )}
    </button>
  );
}

/**
 * Fixed bottom nav — renders on all 5 app routes.
 * Center gap holds the GlobalVoiceOverlay mic (viewport-centered, z-9999).
 * Hides during AI processing/speaking so the waveform pill doesn't collide.
 * Hides on /ai-assistant while the idle welcome screen is active.
 */
export default function AssistantNavBar() {
  const { isProcessing, isSpeaking } = useVoiceContext();
  const pathname = usePathname();
  const assistantIdle = useMirrorStore((s) => s.assistantIdle);

  if (!APP_ROUTES.has(pathname)) return null;
  if (isProcessing || isSpeaking) return null;
  if (pathname === ROUTES.WELCOME && assistantIdle) return null;

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
          <NavButton
            label="Cosmetics"
            route={ROUTES.AI_RECOMMENDATION_COSMETIC}
          />
        </div>

        {/* center gap — GlobalVoiceOverlay mic floats here at viewport center */}
        <div className="w-20 shrink-0" aria-hidden />

        {/* right group */}
        <div className="flex-1 flex items-center justify-between pl-2">
          <NavButton label="Map" route={ROUTES.MAP} />
          <NavButton label="Overview" route={ROUTES.OVERVIEW} />
        </div>
      </div>
    </div>
  );
}
