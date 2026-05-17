"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff } from "lucide-react";
import { matchNavigation } from "./matchNavigation";

// ─── Speech API shim (browser only) ──────────────────────────────────────────

interface SpeechResult {
  readonly [index: number]: { readonly transcript: string };
  readonly isFinal: boolean;
}
interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}
interface SpeechEvent extends Event {
  readonly results: SpeechResultList;
}
interface SpeechRecognitionInstance {
  continuous:     boolean;
  interimResults: boolean;
  lang:           string;
  start(): void;
  stop():  void;
  onresult: ((e: SpeechEvent) => void) | null;
  onend:    (() => void) | null;
  onerror:  ((e: Event) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition:       new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceController() {
  const router = useRouter();

  const [isListening, setIsListening]   = useState(false);
  const [transcript,  setTranscript]    = useState("");
  const [feedback,    setFeedback]      = useState<string | null>(null);

  const recRef         = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef  = useRef("");
  const feedbackTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
  }, []);

  // Clean up timer on unmount (layout never unmounts, but good practice)
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const startListening = useCallback(() => {
    if (isListening) return;

    const SR = typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SR) {
      showFeedback("Speech not supported");
      return;
    }

    setTranscript("");
    transcriptRef.current = "";

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = "en-US";

    rec.onresult = (e: SpeechEvent) => {
      const t = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i][0].transcript,
      ).join("");
      setTranscript(t);
      transcriptRef.current = t;
    };

    rec.onend = () => {
      setIsListening(false);
      const text = transcriptRef.current.trim();
      if (!text) return;

      const route = matchNavigation(text);
      if (route) {
        showFeedback(`Going to ${route}`);
        router.push(route);
      } else {
        showFeedback(`"${text}" — not recognized`);
      }
      setTranscript("");
    };

    rec.onerror = () => {
      setIsListening(false);
      setTranscript("");
    };

    recRef.current = rec;
    setIsListening(true);
    rec.start();
  }, [isListening, router, showFeedback]);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">

      {/* Transcript / feedback bubble */}
      <AnimatePresence>
        {(isListening && transcript) || feedback ? (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,  scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="max-w-xs rounded-2xl px-4 py-2 text-sm text-white/90 bg-white/10 backdrop-blur-md border border-white/15 pointer-events-none"
          >
            {isListening && transcript ? transcript : feedback}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Mic button */}
      <div className="relative pointer-events-auto">
        {/* Pulse rings when listening */}
        <AnimatePresence>
          {isListening && [0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full bg-white/20"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.2 + i * 0.4, opacity: 0 }}
              transition={{ duration: 1.4, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>

        <button
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? "Stop listening" : "Start voice navigation"}
          className={[
            "relative flex items-center justify-center w-14 h-14 rounded-full",
            "transition-colors duration-200 shadow-lg",
            isListening
              ? "bg-white text-black"
              : "bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md",
          ].join(" ")}
        >
          {isListening
            ? <Mic className="w-6 h-6" />
            : <MicOff className="w-6 h-6 opacity-70" />
          }
        </button>
      </div>
    </div>
  );
}
