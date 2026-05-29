"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { ROUTES } from "@/navigation";

const DEFAULT_IDLE_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

/**
 * Returns the kiosk to the Attract screen after `timeoutMs` of no UI activity.
 * Tokens stay installed (see ADR 0002); only navigation changes.
 */
export function useIdleLogout(timeoutMs: number = DEFAULT_IDLE_MS) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout>;

    const returnToAttract = () => {
      router.push(ROUTES.WELCOME);
    };

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(returnToAttract, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, reset, { passive: true }),
    );
    reset();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isAuthenticated, timeoutMs, router]);
}
