"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { mapService } from "../services/map.service";

const THRESHOLDS = [500, 200, 50] as const;

function buildText(instruction: string, distanceM: number, threshold: number): string {
  if (threshold <= 50)  return `${instruction}.`;
  if (distanceM < 1000) return `In ${Math.round(distanceM)} metres, ${instruction.toLowerCase()}.`;
  return `In ${(distanceM / 1000).toFixed(1)} kilometres, ${instruction.toLowerCase()}.`;
}

export function useNavigationAnnouncements() {
  const announcedRef = useRef<Set<string>>(new Set());
  const playbackRef  = useRef<AudioBufferSourceNode | null>(null);
  const playCtxRef   = useRef<AudioContext | null>(null);
  const speakingRef  = useRef(false);

  const speak = async (text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      playbackRef.current?.stop();
      playCtxRef.current?.close();

      const audio   = await mapService.tts(text);
      const playCtx = new AudioContext();
      playCtxRef.current = playCtx;

      const decoded = await playCtx.decodeAudioData(audio.slice(0));
      const src     = playCtx.createBufferSource();
      src.buffer    = decoded;
      src.connect(playCtx.destination);
      playbackRef.current = src;

      src.onended = () => {
        speakingRef.current = false;
        playbackRef.current = null;
        playCtxRef.current?.close();
        playCtxRef.current  = null;
      };
      src.start(0);
    } catch (err) {
      speakingRef.current = false;
      console.error("[useNavigationAnnouncements]", err);
    }
  };

  useEffect(() => {
    const unsub = useMapStore.subscribe((state, prev) => {
      if (!state.isNavigating) {
        announcedRef.current.clear();
        return;
      }

      const { currentStepIndex, distanceToNextManeuver, remainingDistance, activeRoute } = state;

      if (currentStepIndex !== prev.currentStepIndex) {
        for (const t of THRESHOLDS) {
          announcedRef.current.delete(`step-${prev.currentStepIndex}-${t}`);
        }
      }

      if (remainingDistance > 0 && remainingDistance <= 30) {
        if (!announcedRef.current.has("arrival")) {
          announcedRef.current.add("arrival");
          speak("You have arrived at your destination.");
        }
        return;
      }

      const step = activeRoute?.steps?.[currentStepIndex];
      if (!step?.instruction) return;

      for (const threshold of THRESHOLDS) {
        if (distanceToNextManeuver <= threshold) {
          const key = `step-${currentStepIndex}-${threshold}`;
          if (!announcedRef.current.has(key)) {
            announcedRef.current.add(key);
            speak(buildText(step.instruction, distanceToNextManeuver, threshold));
          }
          break;
        }
      }
    });

    return () => {
      unsub();
      playbackRef.current?.stop();
      playCtxRef.current?.close();
    };
  }, []);
}
