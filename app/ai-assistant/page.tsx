"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Mic, Volume2 } from "lucide-react";
import WeatherWidget from "@/components/WeatherWidget";
import { mapService } from "@/modules/map/services/map.service";
import {
  PersistentMic,
  captureCommand,
  delay,
  msOf,
  MIN_TRANSCRIBE_MS,
  WAKE_VAD_THRESHOLD,
} from "./voiceCapture";

type Role = "user" | "assistant";
type Mode = "standby" | "listening" | "thinking" | "speaking";

type Message = {
  id: string;
  role: Role;
  content: string;
  route?: string | null;
  routeLabel?: string | null;
};

// How much recent audio each wake-word transcription looks at, and how often we
// transcribe. The mic records continuously, so consecutive windows OVERLAP —
// a phrase landing on a boundary is captured whole in at least one window.
const WAKE_WINDOW_MS = 2800;
const WAKE_INTERVAL_MS = 900;

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content: 'Hi! I\'m StyleOS AI. Say "Hey Mirror" to start.',
  route: null,
  routeLabel: null,
};

// Fuzzy wake word variants to handle speech-to-text mishearings.
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
  "mirror mirror", // "mirror mirror on the wall"
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
  "morning",
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

function getWakeCommand(text: string) {
  const normalized = normalizeSpeech(text);
  const wakeWord = WAKE_WORDS.find((word) => normalized.includes(word));
  if (wakeWord) {
    let command = normalized
      .slice(normalized.indexOf(wakeWord) + wakeWord.length)
      .trim();
    // "mirror mirror on the wall" is an incantation, not a command — drop it.
    command = command.replace(/^(on the wall|mirror on the wall)\b/, "").trim();
    return { command };
  }

  const words = normalized.split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (!MIRROR_WORDS.has(words[i])) continue;
    const prev = words.slice(Math.max(0, i - 3), i);
    if (prev.some((word) => WAKE_START_WORDS.has(word))) {
      return { command: words.slice(i + 1).join(" ") };
    }
  }

  return null;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function speakText(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 1.05;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(
      (v) =>
        v.lang === "en-US" && /samantha|zira|female|google us/i.test(v.name),
    ) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0];
  if (preferred) utter.voice = preferred;

  let finished = false;
  let watchdog: number | null = null;
  let fallback: number | null = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (watchdog) window.clearInterval(watchdog);
    if (fallback) window.clearTimeout(fallback);
    onEnd?.();
  };

  utter.onend = finish;
  utter.onerror = finish;
  window.speechSynthesis.speak(utter);

  watchdog = window.setInterval(() => {
    if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
      finish();
    }
  }, 400);
  fallback = window.setTimeout(
    finish,
    Math.max(4000, Math.min(25000, text.length * 90 + 2500)),
  );
}

export default function AIAssistantPage() {
  const router = useRouter();
  const now = useClock();

  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [mode, setMode] = useState<Mode>("standby");
  const [transcript, setTranscript] = useState("");
  const [wakeReady, setWakeReady] = useState(false); // shows mic-permission status
  const [wakeDebug, setWakeDebug] = useState("");

  const modeRef = useRef<Mode>("standby");
  const micRef = useRef<PersistentMic | null>(null);
  const wakeRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const wakeLoopRef = useRef(false);
  const wakeAbortRef = useRef<AbortController | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const wakeHeardRef = useRef("");
  const messagesRef = useRef<Message[]>([GREETING]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  function setMode_(m: Mode) {
    modeRef.current = m;
    setMode(m);
  }

  function resumeWakeListening() {
    setTranscript("");
    setWakeDebug("");
    commandAbortRef.current?.abort();
    wakeAbortRef.current?.abort();
    if (wakeRestartTimerRef.current) {
      clearTimeout(wakeRestartTimerRef.current);
      wakeRestartTimerRef.current = null;
    }
    wakeLoopRef.current = false;
    wakeHeardRef.current = "";
    micRef.current?.clear(); // discard any TTS/leftover audio before re-listening
    setWakeReady(true);
    setMode_("standby");
    window.setTimeout(startWakeWord, 100);
  }

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (mode !== "standby") return;
    const id = window.setTimeout(() => startWakeWord(), 150);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Preload TTS voices (Chrome lazy-loads them)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () =>
      window.speechSynthesis.getVoices(),
    );
  }, []);

  // ── Send message to AI ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: trimmed },
    ]);
    setMode_("thinking");

    try {
      const history = messagesRef.current
        .filter((m) => m.id !== "greeting")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/mirror/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const data = (await res.json()) as {
        reply?: string;
        route?: string | null;
        routeLabel?: string | null;
      };

      const reply = data.reply ?? "Sorry, something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          route: data.route ?? null,
          routeLabel: data.routeLabel ?? null,
        },
      ]);

      wakeLoopRef.current = false;
      wakeAbortRef.current?.abort();
      commandAbortRef.current?.abort();
      setWakeReady(false);
      setMode_("speaking");
      speakText(reply, () => {
        if (data.route) {
          router.push(data.route);
          return;
        }
        // Keep the conversation going: listen for a follow-up straight away
        // instead of requiring the wake word again. captureCommand's
        // startTimeout means if the user stays silent (~4.5s) it gracefully
        // falls back to wake-word standby.
        startCommandListening();
      });
    } catch {
      const err = "I couldn't connect. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: err },
      ]);
      resumeWakeListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazily create + open the single shared mic. Idempotent.
  async function ensureMic() {
    if (!micRef.current) micRef.current = new PersistentMic();
    await micRef.current.start();
    return micRef.current;
  }

  // ── Phase 2: capture a command, ended by silence (not a fixed timer) ────────
  async function startCommandListening() {
    if (wakeRestartTimerRef.current) {
      clearTimeout(wakeRestartTimerRef.current);
      wakeRestartTimerRef.current = null;
    }
    setMode_("listening");
    wakeLoopRef.current = false;
    wakeAbortRef.current?.abort();
    setTranscript("");

    const controller = new AbortController();
    commandAbortRef.current = controller;

    try {
      const mic = await ensureMic();
      // Drop anything buffered so far (e.g. the "I'm listening." TTS tail).
      const audio = await captureCommand(mic, controller.signal);
      if (modeRef.current !== "listening") return;

      // Nobody really spoke — don't POST a too-short buffer (backend 422s).
      if (msOf(audio) < MIN_TRANSCRIBE_MS) {
        resumeWakeListening();
        return;
      }

      setTranscript("Processing voice...");
      const text = await mapService.transcribe(audio);
      setTranscript("");

      if (text.trim()) {
        sendMessage(text);
      } else {
        resumeWakeListening();
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort && modeRef.current === "listening") {
        resumeWakeListening();
      }
    } finally {
      commandAbortRef.current = null;
    }
  }

  // ── Phase 1: continuous wake word listener ─────────────────────────────────
  // Defined as a plain function (not useCallback) so it can self-reference.
  // The mic stays open the whole time and audio is buffered continuously, so
  // there is no gap between windows — we just transcribe the most recent
  // WAKE_WINDOW_MS of audio every WAKE_INTERVAL_MS, and the windows overlap.
  function startWakeWord() {
    if (modeRef.current !== "standby") return;
    if (wakeLoopRef.current) return;
    if (wakeRestartTimerRef.current) {
      clearTimeout(wakeRestartTimerRef.current);
      wakeRestartTimerRef.current = null;
    }
    wakeAbortRef.current?.abort();

    wakeLoopRef.current = true;
    setWakeReady(false);

    const scan = async () => {
      if (!wakeLoopRef.current || modeRef.current !== "standby") return;

      const controller = new AbortController();
      wakeAbortRef.current = controller;

      try {
        const mic = await ensureMic();
        setWakeReady(true);

        // Let the rolling buffer fill; the mic never stops recording.
        await delay(WAKE_INTERVAL_MS, controller.signal);
        if (!wakeLoopRef.current || modeRef.current !== "standby") return;

        // Gate transcription on two conditions:
        //  1) enough audio buffered — a near-empty buffer 422s the backend.
        //  2) actual speech in the window (VAD) — otherwise we'd POST silence
        //     every cycle, hammering the backend and surfacing its errors.
        // When neither holds, fall through and reschedule so the buffer keeps
        // filling / we keep listening cheaply.
        if (mic.bufferedMs() < MIN_TRANSCRIBE_MS) {
          setWakeDebug("Warming up mic…");
        } else if (mic.peakLevel(WAKE_WINDOW_MS) < WAKE_VAD_THRESHOLD) {
          setWakeDebug("Listening for wake phrase...");
        } else {
          const text = await mapService.transcribe(mic.tail(WAKE_WINDOW_MS));
          if (!wakeLoopRef.current || modeRef.current !== "standby") return;

          const heard = normalizeSpeech(text);
          if (heard) {
            wakeHeardRef.current = `${wakeHeardRef.current} ${heard}`
              .trim()
              .split(" ")
              .slice(-16)
              .join(" ");
            setWakeDebug(`Heard: "${text.trim()}"`);
          } else {
            setWakeDebug("Listening for wake phrase...");
          }

          const wake = getWakeCommand(wakeHeardRef.current);
          if (wake) {
            wakeLoopRef.current = false;
            setWakeReady(false);
            setWakeDebug("");
            setMode_("speaking");
            if (wake.command) {
              sendMessage(wake.command);
            } else {
              speakText("I'm listening.", startCommandListening);
            }
            return;
          }
        }
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        const isDenied =
          err instanceof DOMException && err.name === "NotAllowedError";
        if (isDenied) wakeLoopRef.current = false;
        if (isDenied) setWakeReady(false);
        if (isDenied) setWakeDebug("Microphone permission is blocked.");
        else if (!isAbort && wakeLoopRef.current) {
          setWakeReady(true);
          setWakeDebug("Voice transcription is not responding.");
        }
      } finally {
        wakeAbortRef.current = null;
      }

      if (wakeLoopRef.current && modeRef.current === "standby") {
        setWakeReady(true);
        // No extra gap — pacing is handled by the WAKE_INTERVAL_MS delay above.
        wakeRestartTimerRef.current = setTimeout(scan, 0);
      }
    };

    scan();
  }

  // Auto-start on mount
  useEffect(() => {
    startWakeWord();
    return () => {
      if (wakeRestartTimerRef.current)
        clearTimeout(wakeRestartTimerRef.current);
      wakeLoopRef.current = false;
      wakeAbortRef.current?.abort();
      commandAbortRef.current?.abort();
      micRef.current?.stop();
      micRef.current = null;
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastMessage = messages[messages.length - 1];
  const isListening = mode === "listening";
  const isSpeaking = mode === "speaking";
  const isThinking = mode === "thinking";
  const isStandby = mode === "standby";
  const isWakeListening = isStandby && wakeReady;
  const showListening = isListening || isWakeListening;

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header
        className="flex items-center shrink-0 py-5 px-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div style={{ flex: "0 0 25%", display: "flex", alignItems: "center" }}>
          <WeatherWidget iconSize={36} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              style={{ width: 16, height: 16, color: "rgba(255,255,255,0.45)" }}
            />
            <span
              className="text-white font-semibold select-none"
              style={{ fontSize: "1.15rem" }}
            >
              AI Assistant
            </span>
          </div>
          <span
            className="text-white/35 select-none"
            style={{ fontSize: "0.8rem", marginTop: 2 }}
          >
            {time} · {day}, {date}
          </span>
        </div>
        <div style={{ flex: "0 0 25%" }} />
      </header>

      {/* ── Last message ── */}
      <div className="shrink-0 px-8 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={lastMessage.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems:
                lastMessage.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.28)",
                marginBottom: 6,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {lastMessage.role === "user" ? "You" : "StyleOS AI"}
            </span>
            <div
              style={{
                maxWidth: "80%",
                padding: "18px 22px",
                borderRadius:
                  lastMessage.role === "user"
                    ? "22px 22px 6px 22px"
                    : "22px 22px 22px 6px",
                background:
                  lastMessage.role === "user"
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.06)",
                border:
                  lastMessage.role === "user"
                    ? "1px solid rgba(255,255,255,0.15)"
                    : "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.9)",
                fontSize: "1.05rem",
                lineHeight: 1.6,
              }}
            >
              {lastMessage.content}
            </div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-1"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.2, 0.9, 0.2] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    delay: i * 0.18,
                  }}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.5)",
                    display: "block",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mic — centered in remaining space ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        <div
          style={{
            position: "relative",
            width: 180,
            height: 180,
            overflow: "visible",
          }}
        >
          {/* Standby: slow breathing ring */}
          {isStandby && !isWakeListening && (
            <motion.span
              animate={{ scale: [1, 1.14, 1], opacity: [0.1, 0.25, 0.1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.5)",
                pointerEvents: "none",
              }}
            />
          )}

          {showListening && (
            <motion.span
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.35, 0.75, 0.35],
              }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: "easeInOut",
              }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid rgba(79,195,247,0.7)",
                boxShadow: "0 0 28px rgba(79,195,247,0.35)",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Speaking: medium pulse */}
          {isSpeaking && (
            <motion.span
              animate={{ scale: [1, 1.22, 1], opacity: [0.15, 0.45, 0.15] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.6)",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Voice status */}
          <motion.div
            animate={
              showListening
                ? {
                    scale: [1, 1.08, 1],
                    boxShadow: [
                      "0 0 24px rgba(79,195,247,0.25)",
                      "0 0 44px rgba(79,195,247,0.45)",
                      "0 0 24px rgba(79,195,247,0.25)",
                    ],
                  }
                : isSpeaking
                  ? {
                      scale: 1,
                      boxShadow: [
                        "0 0 0px rgba(255,255,255,0)",
                        "0 0 40px rgba(255,255,255,0.14)",
                        "0 0 0px rgba(255,255,255,0)",
                      ],
                    }
                  : { scale: 1 }
            }
            transition={
              showListening || isSpeaking
                ? { duration: 1.8, repeat: Infinity }
                : {}
            }
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: showListening
                ? "rgba(79,195,247,0.2)"
                : isSpeaking
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.05)",
              border: showListening
                ? "2px solid rgba(79,195,247,0.7)"
                : "2px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              transition: "background 0.4s, border 0.4s",
            }}
          >
            {isSpeaking ? (
              <Volume2
                style={{
                  width: 68,
                  height: 68,
                  color: "rgba(255,255,255,0.75)",
                }}
              />
            ) : (
              <Mic
                style={{
                  width: 68,
                  height: 68,
                  color: showListening ? "white" : "rgba(255,255,255,0.35)",
                }}
              />
            )}
          </motion.div>
        </div>

        {/* Status label */}
        <AnimatePresence mode="wait">
          {showListening && (
            <motion.div
              key="listening"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                maxWidth: "65%",
              }}
            >
              <p
                style={{
                  fontSize: "1.05rem",
                  color: "rgba(255,255,255,0.96)",
                  lineHeight: 1.5,
                }}
              >
                {transcript || "Listening…"}
              </p>
              {isWakeListening && (
                <>
                  <p
                    style={{
                      fontSize: "0.82rem",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    Say{" "}
                    <span
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        fontStyle: "italic",
                      }}
                    >
                      &ldquo;Hey Mirror&rdquo;
                    </span>
                  </p>
                  {wakeDebug && (
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.7)",
                        maxWidth: 360,
                        lineHeight: 1.4,
                      }}
                    >
                      {wakeDebug}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          )}
          {isSpeaking && (
            <motion.p
              key="speaking"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.4)",
                textAlign: "center",
              }}
            >
              Speaking…
            </motion.p>
          )}
          {isThinking && (
            <motion.p
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.3)",
                textAlign: "center",
              }}
            >
              Thinking…
            </motion.p>
          )}
          {isStandby && !isWakeListening && (
            <motion.div
              key="standby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <p
                style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.22)" }}
              >
                Say{" "}
                <span
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;Hey Mirror&rdquo;
                </span>{" "}
                or tap
              </p>
              {/* Wake word listener status dot */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 2,
                }}
              >
                <motion.span
                  animate={{ opacity: wakeReady ? [0.4, 1, 0.4] : 0.2 }}
                  transition={
                    wakeReady ? { duration: 2, repeat: Infinity } : {}
                  }
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: wakeReady
                      ? "rgba(100,255,150,0.8)"
                      : "rgba(255,255,255,0.2)",
                    display: "block",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.18)",
                  }}
                >
                  {wakeReady ? "always listening" : "starting mic…"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
