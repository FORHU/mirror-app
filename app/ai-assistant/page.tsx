"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import MirrorHeader from "@/components/MirrorHeader";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";


const IDLE_TIMEOUT_MS = 480_000;
type HandsFreePhase = "starting" | "wake" | "command" | "processing" | "error";

const TAGLINES = [
  "Ask me to navigate anywhere.",
  'Say "Hey Mirror" to check the weather.',
  "I can recommend outfits for your day.",
  "Your mirror. Always ready.",
  "Reflect. Navigate. Discover.",
];

const WAKE_WORDS = [
  "hey mirror",
  "hey mere",
  "a mirror",
  "hey miror",
  "hey mira",
  "hey miro",
  "hey nero",
  "hay mirror",
  "ok mirror",
  "hi mirror",
  "okay mirror",
  "hello mirror",
  "hello mere",
  "hello miror",
  "magic mirror",
  "mirror mirror",
];

const WAKE_START_WORDS = new Set([
  "hey",
  "hay",
  "hi",
  "ok",
  "okay",
  "a",
  "hello",
  "yo",
  "magic",
]);

const MIRROR_WORDS = new Set([
  "mirror",
  "miror",
  "mira",
  "miro",
  "mere",
  "nero",
  "mirra",
  "meera",
  "meer",
  "mearer",
  "mirah",
  "murah",
]);

function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingWakePhrases(text: string) {
  let command = text.trim();
  let changed = true;

  while (changed) {
    changed = false;
    for (const word of WAKE_WORDS) {
      if (command === word) return "";
      if (command.startsWith(`${word} `)) {
        command = command.slice(word.length).trim();
        changed = true;
      }
    }
  }

  return command
    .replace(/^(on the wall|mirror on the wall)\b/, "")
    .trim();
}

function isWakeOnly(text: string) {
  return stripLeadingWakePhrases(normalizeSpeech(text)) === "";
}

function getWakeCommand(text: string) {
  const normalized = normalizeSpeech(text);
  const wakeWord = WAKE_WORDS.find((word) => normalized.lastIndexOf(word) >= 0);
  if (wakeWord) {
    const idx = normalized.lastIndexOf(wakeWord);
    const command = stripLeadingWakePhrases(
      normalized.slice(idx + wakeWord.length),
    );
    return { command };
  }

  const words = normalized.split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (!MIRROR_WORDS.has(words[i])) continue;
    const prev = words.slice(Math.max(0, i - 3), i);
    if (prev.some((word) => WAKE_START_WORDS.has(word))) {
      return { command: stripLeadingWakePhrases(words.slice(i + 1).join(" ")) };
    }
  }

  return null;
}

export default function AIAssistantPage() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<{ stop: () => void; clear: () => void } | null>(null);
  const wakeLoopRef = useRef(false);
  const wakeHeardRef = useRef("");
  const voiceStateRef = useRef("idle");
  const submitTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  const [handsFreeReady, setHandsFreeReady] = useState(false);
  const [handsFreeDebug, setHandsFreeDebug] = useState("");
  const [handsFreePhase, setHandsFreePhase] =
    useState<HandsFreePhase>("starting");
  const [showIdle, setShowIdle] = useState(true);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageContext = useMemo(
    () => ({
      route: ROUTES.AI_ASSISTANT,
      pageName: "AI Assistant",
      activeStep: "conversation",
    }),
    [],
  );

  useVoice(pageContext);

  const {
    voiceState,
    transcript,
    reply,
    error,
    toggle,
    isListening,
    isProcessing,
    isSpeaking,
    chatHistory,
    submitText,
  } = useVoiceContext();

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    submitTextRef.current = submitText;
  }, [submitText]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, transcript, reply, error]);

  const taglines = useMemo(() => {
    const hour = new Date().getHours();
    const timeTagline =
      hour >= 5 && hour < 12
        ? "Good morning. What's on your mind?"
        : hour >= 17
          ? "Good evening. Ready when you are."
          : "Ready when you are.";
    return [...TAGLINES, timeTagline];
  }, []);

  // Cycle taglines every 5s while idle screen is visible
  useEffect(() => {
    if (!showIdle) return;
    const id = setInterval(
      () => setTaglineIndex((i) => (i + 1) % taglines.length),
      5000,
    );
    return () => clearInterval(id);
  }, [showIdle, taglines.length]);

  // Exit idle when wake word fires
  useEffect(() => {
    if (handsFreePhase === "command" || handsFreePhase === "processing") {
      queueMicrotask(() => setShowIdle(false));
    }
  }, [handsFreePhase]);

  // Inactivity timeout — return to idle after IDLE_TIMEOUT_MS
  useEffect(() => {
    if (showIdle) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(
      () => setShowIdle(true),
      IDLE_TIMEOUT_MS,
    );
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [showIdle, voiceState, chatHistory, handsFreePhase]);

  const status = isListening
    ? "Listening"
    : isProcessing
      ? "Thinking"
      : isSpeaking
        ? "Speaking"
        : handsFreePhase === "command"
          ? "Listening"
          : handsFreePhase === "processing"
            ? "Thinking"
            : handsFreeReady || handsFreePhase === "wake"
          ? "Say Hey Mirror"
          : "Starting mic";

  const latest = chatHistory[chatHistory.length - 1];
  const displayUser = transcript || latest?.user || "";
  const displayReply =
    error ||
    reply ||
    latest?.assistant ||
    "Hi! What can I do for you?";

  const startWakeWord = useCallback(() => {
    if (wakeLoopRef.current) return;
    if (voiceStateRef.current !== "idle") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as (new () => { continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }) | undefined;
    if (!SR) {
      setHandsFreePhase("error");
      setHandsFreeDebug("Speech recognition unsupported");
      return;
    }

    wakeLoopRef.current = true;
    setHandsFreeReady(true);
    setHandsFreePhase("wake");
    setHandsFreeDebug("Listening for wake phrase");

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (!wakeLoopRef.current || voiceStateRef.current !== "idle") return;

      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }

      const currentText = (final + " " + interim).trim();
      if (!currentText) return;

      const heard = normalizeSpeech(currentText);
      wakeHeardRef.current = heard;
      setHandsFreeDebug(`Heard: "${currentText}"`);

      const wake = getWakeCommand(heard);
      if (wake) {
        wakeLoopRef.current = false;
        recognition.stop();
        setHandsFreeReady(false);
        setHandsFreePhase(wake.command ? "processing" : "command");
        setShowIdle(false);
        setHandsFreeDebug(wake.command ? "Processing" : "Listening");
        wakeHeardRef.current = "";

        if (wake.command && !isWakeOnly(wake.command)) {
          submitTextRef.current(wake.command);
        } else {
          toggle();
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setHandsFreeReady(false);
        setHandsFreePhase("error");
        setHandsFreeDebug("Microphone blocked");
        wakeLoopRef.current = false;
      }
    };

    recognition.onend = () => {
      if (wakeLoopRef.current && voiceStateRef.current === "idle") {
        // Auto-restart continuous listening if it stops randomly
        recognition.start();
      }
    };

    try {
      recognition.start();
      micRef.current = { stop: () => recognition.stop(), clear: () => {} };
    } catch {
      setHandsFreeDebug("Voice unavailable");
    }
  }, [toggle]);

  useEffect(() => {
    if (showIdle) return;
    const id = window.setTimeout(startWakeWord, 0);
    return () => {
      window.clearTimeout(id);
      wakeLoopRef.current = false;
      micRef.current?.stop();
    };
  }, [startWakeWord, showIdle]);

  useEffect(() => {
    if (showIdle) return;
    if (voiceState === "idle" && !wakeLoopRef.current) {
      const id = window.setTimeout(startWakeWord, 350);
      return () => window.clearTimeout(id);
    }
  }, [startWakeWord, voiceState, showIdle]);

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      <MirrorHeader
        right={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]">
            <Sparkles className="w-4 h-4 text-white/60" />
            <span className="text-white/65 text-xs">{status}</span>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {showIdle ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col items-center justify-center px-12 cursor-pointer"
            onClick={() => setShowIdle(false)}
          >
            <div className="flex items-center justify-center" style={{ minHeight: "8rem" }}>
              <AnimatePresence mode="wait">
                <motion.p
                  key={taglineIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-white font-thin text-center leading-[1.15] tracking-tight"
                  style={{ fontSize: "clamp(2rem, 6.5vw, 3.75rem)" }}
                >
                  {taglines[taglineIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="h-px w-12 bg-white/15" />
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/30 font-light">
                Say &ldquo;Hey Mirror&rdquo; to begin
              </p>
            </div>

            <motion.div
              className="mt-10 flex flex-col items-center gap-3"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div
                className="rounded-full border border-white/20"
                style={{ width: 48, height: 48 }}
              />
              <p className="text-[9px] uppercase tracking-[0.5em] text-white/25 font-light">
                Tap to start
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.main
            key="assistant"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-h-0 flex flex-col px-10 py-8"
          >
            {/* conversation — top half */}
            <div className="flex-1 min-h-0 flex flex-col justify-center max-w-2xl mx-auto w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${displayUser}-${displayReply}-${voiceState}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-8"
                >
                  {displayUser && (
                    <div className="text-right">
                      <p className="text-white/25 text-[9px] uppercase tracking-[0.4em] font-light mb-2">
                        You said
                      </p>
                      <p className="text-white/55 text-lg font-light leading-relaxed">
                        {displayUser}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/25 text-[9px] uppercase tracking-[0.4em] font-light mb-2">
                      Mirror
                    </p>
                    <p
                      className={`font-thin leading-[1.3] tracking-tight ${
                        error ? "text-red-300/75" : "text-white/90"
                      }`}
                      style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}
                    >
                      {displayReply}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ambient state indicator — centered in bottom half */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <motion.button
                type="button"
                onClick={toggle}
                aria-label="Toggle voice input"
                className="rounded-full outline-none"
                style={{
                  width: 56,
                  height: 56,
                  background:
                    isListening || handsFreePhase === "command"
                      ? "rgba(255,255,255,0.10)"
                      : isSpeaking
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(255,255,255,0.04)",
                  border:
                    isListening || handsFreePhase === "command"
                      ? "1px solid rgba(255,255,255,0.40)"
                      : isSpeaking
                        ? "1px solid rgba(255,255,255,0.25)"
                        : "1px solid rgba(255,255,255,0.10)",
                }}
                animate={
                  isListening || handsFreePhase === "command"
                    ? { scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }
                    : isProcessing || handsFreePhase === "processing"
                      ? { opacity: [0.4, 0.9, 0.4] }
                      : isSpeaking
                        ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }
                        : { scale: 1, opacity: 0.4 }
                }
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <p className="text-white/50 text-[10px] uppercase tracking-[0.4em] font-light">
                {status}
              </p>
              {handsFreeDebug && (
                <p className="text-white/20 text-[9px] tracking-wide">
                  {handsFreeDebug}
                </p>
              )}
            </div>

            <div ref={bottomRef} />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
