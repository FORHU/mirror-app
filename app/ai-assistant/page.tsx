"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Loader2, Volume2, Sparkles } from "lucide-react";
import MirrorHeader from "@/components/MirrorHeader";
import { mapService } from "@/modules/map/services/map.service";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ROUTES } from "@/navigation";

const WAKE_WINDOW_MS = 2800;
const WAKE_INTERVAL_MS = 900;
type HandsFreePhase = "starting" | "wake" | "command" | "processing" | "error";

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

  return command.replace(/^(on the wall|mirror on the wall)\b/, "").trim();
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
  const micRef = useRef<any>(null);
  const wakeLoopRef = useRef(false);
  const wakeAbortRef = useRef<AbortController | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const wakeHeardRef = useRef("");
  const voiceStateRef = useRef("idle");
  const submitTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  const [handsFreeReady, setHandsFreeReady] = useState(false);
  const [handsFreeDebug, setHandsFreeDebug] = useState("");
  const [handsFreePhase, setHandsFreePhase] =
    useState<HandsFreePhase>("starting");
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
    error || reply || latest?.assistant || "Hi! What can I do for you?";

  const micIcon = isListening ? (
    <MicOff className="w-16 h-16 text-white" />
  ) : isProcessing ? (
    <Loader2 className="w-16 h-16 text-white animate-spin" />
  ) : isSpeaking ? (
    <Volume2 className="w-16 h-16 text-white" />
  ) : (
    <Mic className="w-16 h-16 text-white/75" />
  );

  const startWakeWord = useCallback(() => {
    if (wakeLoopRef.current) return;
    if (voiceStateRef.current !== "idle") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setHandsFreePhase("error");
      setHandsFreeDebug("Speech recognition unsupported");
      return;
    }

    wakeLoopRef.current = true;
    setHandsFreeReady(true);
    setHandsFreePhase("wake");
    setHandsFreeDebug("Listening for wake phrase");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
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
        setHandsFreeDebug(wake.command ? "Processing" : "Listening");
        wakeHeardRef.current = "";

        if (wake.command && !isWakeOnly(wake.command)) {
          submitTextRef.current(wake.command);
        } else {
          // Trigger the standard VoiceProvider recording flow
          toggle();
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
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
      // Store on ref to abort on unmount
      (micRef as any).current = {
        stop: () => recognition.stop(),
        clear: () => {},
      };
    } catch {
      setHandsFreeDebug("Voice unavailable");
    }
  }, [toggle]);

  useEffect(() => {
    // startWakeWord subscribes to the SpeechRecognition external system on mount;
    // its synchronous setState calls are initial UI state, not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startWakeWord();
    return () => {
      wakeLoopRef.current = false;
      if ((micRef as any).current) {
        (micRef as any).current.stop();
      }
    };
  }, [startWakeWord]);

  useEffect(() => {
    if (voiceState === "idle" && !wakeLoopRef.current) {
      const id = window.setTimeout(startWakeWord, 350);
      return () => window.clearTimeout(id);
    }
  }, [restartTick, startWakeWord, voiceState]);

  // Manual mic tap: release the continuous wake-word recognizer first so the
  // recording recognizer can take the mic (Chrome allows only one at a time).
  // If we're already recording/speaking, toggle immediately. Otherwise stop the
  // wake loop and defer the start until the engine frees. The idle effect above
  // re-arms the wake loop when we return.
  const handleMicTap = useCallback(() => {
    if (voiceStateRef.current !== "idle") {
      toggle();
      return;
    }
    wakeLoopRef.current = false;
    if ((micRef as any).current) (micRef as any).current.stop();
    setHandsFreeReady(false);
    setHandsFreePhase("starting");
    setHandsFreeDebug("Starting mic");
    // Give the wake recognizer a beat to fully release the speech engine before
    // the recording recognizer starts (Chrome allows only one active at a time).
    window.setTimeout(() => toggle(), 350);
  }, [toggle]);

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
            onClick={handleMicTap}
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
