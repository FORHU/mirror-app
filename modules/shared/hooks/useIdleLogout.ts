"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { ROUTES } from "@/navigation";
import { endKioskSession } from "@/modules/shared/utils/end-kiosk-session";

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
 * Auto-logs the user out after `timeoutMs` of no UI activity.
 * No-op when the user isn't authenticated, so it's safe to mount globally.
 */
export function useIdleLogout(timeoutMs: number = DEFAULT_IDLE_MS) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout>;

    const fireLogout = async () => {
      await endKioskSession();
      router.push(ROUTES.WELCOME);
    };

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(fireLogout, timeoutMs);
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
