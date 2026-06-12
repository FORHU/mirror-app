"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { performRestart } from "@/modules/shared/voice/sessionCommands";

const WALK_AWAY_DELAY_MS = 1000;

/**
 * Watches isPresent in the global store. When the user was detected
 * and then walks away (isPresent goes false), restarts the session
 * after a short debounce so brief occlusions don't trigger a reset.
 *
 * Does nothing if the camera is unavailable (isPresent never became true).
 */
export function WalkAwayWatcher() {
  const isPresent = useMirrorStore((s) => s.isPresent);
  const sensorStatus = useMirrorStore((s) => s.sensorStatus);
  const router = useRouter();
  const wasPresentRef = useRef(false);

  useEffect(() => {
    if (sensorStatus === "unavailable") return;

    if (isPresent) {
      wasPresentRef.current = true;
      return;
    }

    if (!wasPresentRef.current) return;

    const id = setTimeout(() => {
      wasPresentRef.current = false;
      performRestart(router).catch(() => {});
    }, WALK_AWAY_DELAY_MS);

    return () => clearTimeout(id);
  }, [isPresent, sensorStatus, router]);

  return null;
}
