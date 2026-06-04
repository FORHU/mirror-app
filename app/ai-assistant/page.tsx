"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Loader2, Volume2, Sparkles } from "lucide-react";
import MirrorHeader from "@/components/MirrorHeader";
import { mapService } from "@/modules/map/services/map.service";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";
import {
  PersistentMic,
  captureCommand,
  delay,
  msOf,
  MIN_TRANSCRIBE_MS,
  WAKE_VAD_THRESHOLD,
} from "./voiceCapture";

const WAKE_WINDOW_MS = 2800;
const WAKE_INTERVAL_MS = 900;

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
  const micRef = useRef<PersistentMic | null>(null);
  const wakeLoopRef = useRef(false);
  const wakeAbortRef = useRef<AbortController | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const wakeHeardRef = useRef("");
  const voiceStateRef = useRef("idle");
  const submitTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  const [handsFreeReady, setHandsFreeReady] = useState(false);
  const [handsFreeDebug, setHandsFreeDebug] = useState("");
  const [restartTick, setRestartTick] = useState(0);

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

  const isIdle = voiceState === "idle";
  const status = isListening
    ? "Listening"
    : isProcessing
      ? "Thinking"
      : isSpeaking
        ? "Speaking"
        : handsFreeReady
          ? "Say Hey Mirror"
          : "Starting mic";

  const latest = chatHistory[chatHistory.length - 1];
  const displayUser = transcript || latest?.user || "";
  const displayReply =
    error ||
    reply ||
    latest?.assistant ||
    "Hi! What can I do for you?";

  const micIcon = isListening ? (
    <MicOff className="w-16 h-16 text-white" />
  ) : isProcessing ? (
    <Loader2 className="w-16 h-16 text-white animate-spin" />
  ) : isSpeaking ? (
    <Volume2 className="w-16 h-16 text-white" />
  ) : (
    <Mic className="w-16 h-16 text-white/75" />
  );

  const ensureMic = useCallback(async () => {
    if (!micRef.current) micRef.current = new PersistentMic();
    await micRef.current.start();
    return micRef.current;
  }, []);

  const startCommandListening = useCallback(async () => {
    wakeLoopRef.current = false;
    wakeAbortRef.current?.abort();
    setHandsFreeReady(false);
    setHandsFreeDebug("Listening");

    const controller = new AbortController();
    commandAbortRef.current = controller;

    try {
      const mic = await ensureMic();
      const audio = await captureCommand(mic, controller.signal);
      if (msOf(audio) < MIN_TRANSCRIBE_MS) return;

      setHandsFreeDebug("Processing");
      const text = await mapService.transcribe(audio);
      if (text.trim()) await submitTextRef.current(text);
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) setHandsFreeDebug("Voice unavailable");
    } finally {
      commandAbortRef.current = null;
      micRef.current?.clear();
      if (voiceStateRef.current === "idle") {
        wakeLoopRef.current = false;
        setRestartTick((tick) => tick + 1);
      }
    }
  }, [ensureMic]);

  const startWakeWord = useCallback(() => {
    if (wakeLoopRef.current) return;
    if (voiceStateRef.current !== "idle") return;

    wakeLoopRef.current = true;
    setHandsFreeReady(false);
    setHandsFreeDebug("Starting mic");
    wakeAbortRef.current?.abort();

    const scan = async () => {
      if (!wakeLoopRef.current) return;

      if (voiceStateRef.current !== "idle") {
        setHandsFreeReady(false);
        setHandsFreeDebug("");
        wakeLoopRef.current = false;
        setRestartTick((tick) => tick + 1);
        return;
      }

      const controller = new AbortController();
      wakeAbortRef.current = controller;

      try {
        const mic = await ensureMic();
        setHandsFreeReady(true);
        await delay(WAKE_INTERVAL_MS, controller.signal);
        if (!wakeLoopRef.current || voiceStateRef.current !== "idle") return;

        if (mic.bufferedMs() < MIN_TRANSCRIBE_MS) {
          setHandsFreeDebug("Warming up");
        } else if (mic.peakLevel(WAKE_WINDOW_MS) < WAKE_VAD_THRESHOLD) {
          setHandsFreeDebug("Listening for wake phrase");
        } else {
          const text = await mapService.transcribe(mic.tail(WAKE_WINDOW_MS));
          if (!wakeLoopRef.current || voiceStateRef.current !== "idle") return;

          const heard = normalizeSpeech(text);
          if (heard) {
            wakeHeardRef.current = `${wakeHeardRef.current} ${heard}`
              .trim()
              .split(" ")
              .slice(-16)
              .join(" ");
            setHandsFreeDebug(`Heard: "${text.trim()}"`);
          }

          const wake = getWakeCommand(wakeHeardRef.current);
          if (wake) {
            wakeLoopRef.current = false;
            setHandsFreeReady(false);
            setHandsFreeDebug(wake.command ? "Processing" : "Listening");
            wakeHeardRef.current = "";
            mic.clear();
            if (wake.command && !isWakeOnly(wake.command)) {
              await submitTextRef.current(wake.command);
            } else {
              await startCommandListening();
            }
            return;
          }
        }
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        const isDenied =
          err instanceof DOMException && err.name === "NotAllowedError";
        if (isDenied) {
          setHandsFreeReady(false);
          setHandsFreeDebug("Microphone blocked");
          wakeLoopRef.current = false;
          return;
        }
        if (!isAbort) setHandsFreeDebug("Voice unavailable");
      } finally {
        wakeAbortRef.current = null;
      }

      if (wakeLoopRef.current) {
        window.setTimeout(scan, 0);
      }
    };

    void scan();
  }, [ensureMic, startCommandListening]);

  useEffect(() => {
    startWakeWord();
    return () => {
      wakeLoopRef.current = false;
      wakeAbortRef.current?.abort();
      commandAbortRef.current?.abort();
      micRef.current?.stop();
      micRef.current = null;
    };
  }, [startWakeWord]);

  useEffect(() => {
    if (voiceState === "idle" && !wakeLoopRef.current) {
      micRef.current?.clear();
      const id = window.setTimeout(startWakeWord, 350);
      return () => window.clearTimeout(id);
    }
  }, [restartTick, startWakeWord, voiceState]);

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

      <main className="flex-1 min-h-0 flex flex-col px-8 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2">
            <Sparkles className="w-5 h-5 text-white/45" />
            <h1 className="text-white text-3xl font-semibold tracking-tight">
              AI Assistant
            </h1>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${displayUser}-${displayReply}-${voiceState}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-3xl space-y-4"
            >
              {displayUser && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-md border border-white/15 bg-white/10 px-5 py-4">
                    <p className="text-white/45 text-xs uppercase tracking-wide mb-1">
                      You
                    </p>
                    <p className="text-white/90 text-base leading-relaxed">
                      {displayUser}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-start">
                <div
                  className={`max-w-[80%] rounded-2xl rounded-tl-md border px-5 py-4 ${
                    error
                      ? "border-red-400/25 bg-red-500/10"
                      : "border-white/10 bg-white/[0.055]"
                  }`}
                >
                  <p className="text-white/45 text-xs uppercase tracking-wide mb-1">
                    StyleOS AI
                  </p>
                  <p className="text-white/88 text-base leading-relaxed">
                    {displayReply}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={toggle}
            className="relative flex items-center justify-center rounded-full outline-none"
            style={{
              width: 172,
              height: 172,
              background: isIdle
                ? "rgba(255,255,255,0.055)"
                : "rgba(79,195,247,0.18)",
              border: isIdle
                ? "1px solid rgba(255,255,255,0.14)"
                : "2px solid rgba(79,195,247,0.75)",
              boxShadow: isIdle
                ? "0 0 40px rgba(255,255,255,0.04)"
                : "0 0 52px rgba(79,195,247,0.35)",
            }}
            animate={
              isListening
                ? { scale: [1, 1.04, 1] }
                : isProcessing || isSpeaking
                  ? { scale: [1, 1.025, 1] }
                  : { scale: 1 }
            }
            transition={
              isIdle ? undefined : { duration: 1.25, repeat: Infinity }
            }
            aria-label="Voice assistant"
          >
            {micIcon}
          </motion.button>

          <div className="text-center min-h-12">
            <p className="text-white/85 text-lg">{status}</p>
            {handsFreeDebug && (
              <p className="text-white/35 text-sm mt-1">{handsFreeDebug}</p>
            )}
          </div>
        </div>

        <div ref={bottomRef} />
      </main>
    </div>
  );
}
