"use client";

import { useEffect, useRef, useCallback } from "react";

// Phrases that trigger the assistant
const WAKE_PHRASES = ["hello mirror", "hey mirror", "hi mirror", "hello, mirror"];

type SR = typeof window extends { SpeechRecognition: infer T } ? T : never;

function getSpeechRecognition(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as (new () => SR) | null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

/**
 * Continuously listens for the wake phrase and calls `onDetected` when heard.
 * Pass `enabled = false` while the main voice pipeline is active so they
 * don't compete for the microphone.
 */
export function useWakeWord(onDetected: () => void, enabled: boolean) {
  const recognitionRef = useRef<SR | null>(null);
  const enabledRef    = useRef(enabled);
  const onDetectedRef = useRef(onDetected);
  const startedRef    = useRef(false);

  // Keep refs in sync without re-running the effect
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  const stop = useCallback(() => {
    startedRef.current = false;
    try { (recognitionRef.current as unknown as { abort(): void } | null)?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (!enabledRef.current || startedRef.current) return;

    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    startedRef.current = true;
    const rec = new Ctor();
    const r = rec as unknown as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((e: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start(): void;
      abort(): void;
    };

    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = (event) => {
      for (let i = event.results.length - 1; i >= 0; i--) {
        const text = (event.results[i][0].transcript as string).toLowerCase().trim();
        if (WAKE_PHRASES.some((phrase) => text.includes(phrase))) {
          // Release mic before the main pipeline grabs it
          startedRef.current = false;
          r.abort();
          onDetectedRef.current();
          return;
        }
      }
    };

    r.onerror = (event) => {
      startedRef.current = false;
      // not-allowed / service-not-allowed are permanent — don't retry
      if (event.error === "not-allowed" || event.error === "service-not-allowed") return;
      if (enabledRef.current) setTimeout(start, 1000);
    };

    r.onend = () => {
      startedRef.current = false;
      // Auto-restart when idle (speech detection stops after ~60 s of silence)
      if (enabledRef.current) setTimeout(start, 300);
    };

    recognitionRef.current = rec;
    try { r.start(); } catch { startedRef.current = false; }
  }, [stop]);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [enabled, start, stop]);
}
