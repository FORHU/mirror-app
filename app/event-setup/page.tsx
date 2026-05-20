"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { API_URL } from "@/modules/shared/config/device.config";
import type { ChatWonderAction, EventSetupData } from "@/modules/shared/ai/chatwonder.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssistantState = "awakening" | "responding" | "listening" | "processing" | "summary" | "done";
type ConversationStep = "event" | "event_type" | "datetime" | "location" | "weather" | "confirm";

type Message = { role: "assistant" | "user"; text: string };

// Minimal Web Speech API types
interface MirrorSpeechResult {
  readonly [index: number]: { readonly transcript: string };
}
interface MirrorSpeechResultList {
  readonly length: number;
  readonly [index: number]: MirrorSpeechResult;
}
interface MirrorSpeechEvent extends Event {
  readonly results: MirrorSpeechResultList;
}
interface MirrorSpeechRecognition {
  continuous:     boolean;
  interimResults: boolean;
  lang:           string;
  start(): void;
  stop():  void;
  onresult: ((e: MirrorSpeechEvent) => void) | null;
  onend:    (() => void) | null;
  onerror:  ((e: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition:       new() => MirrorSpeechRecognition;
    webkitSpeechRecognition: new() => MirrorSpeechRecognition;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

type WeatherResult = { temp: string; condition: string; icon: string };

async function fetchWeather(location: string | null): Promise<WeatherResult> {
  try {
    let lat: number | undefined;
    let lng: number | undefined;

    // Try to resolve coordinates from map store
    const { useMapStore } = await import("@/modules/map/store/useMapStore");
    const s = useMapStore.getState();
    const loc = s.userLocation ?? s.homeLocation;
    lat = loc?.lat;
    lng = loc?.lng;

    if (!lat || !lng) throw new Error("no location");

    const res = await fetch(`${API_URL}/api/mirror/weather?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error("weather fetch failed");
    const data = await res.json();
    return {
      temp:      `${Math.round(data.temperature)}°C`,
      condition: data.condition,
      icon:      data.icon ?? "⛅",
    };
  } catch {
    return { temp: "—", condition: location ? `Near ${location}` : "Weather unavailable", icon: "⛅" };
  }
}

const STEP_ORDER: ConversationStep[] = ["event", "event_type", "datetime", "location", "weather", "confirm"];
const EMPTY_DATA: EventSetupData = { eventName: null, eventType: null, dateTime: null, location: null };

function getPrompt(step: ConversationStep, data: EventSetupData, name: string): string {
  switch (step) {
    case "event":      return `Hi ${name}! What's the occasion today?`;
    case "event_type": return `Is it more of a casual or formal event?`;
    case "datetime":   return `Nice! When is it happening?`;
    case "location":   return `Got it. Where will it be?`;
    case "weather":    return `Let me check the weather for ${data.location}…`;
    case "confirm":    return `Here's what I've got. Everything look right?`;
  }
}

// ─── Soft Ring ────────────────────────────────────────────────────────────────

function SoftRing({ state }: { state: AssistantState }) {
  const isListening  = state === "listening";
  const isProcessing = state === "processing";

  const ringColor = isListening
    ? "0 0 0 1.5px rgba(255,255,255,0.9)"
    : isProcessing
    ? "0 0 0 1.5px rgba(255,255,255,0.55)"
    : state === "summary"
    ? "0 0 0 1.5px rgba(255,255,255,0.28)"
    : "0 0 0 1.5px rgba(255,255,255,0.42)";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 88, height: 88 }}>
      <AnimatePresence>
        {isListening && [0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ border: "1px solid rgba(255,255,255,0.5)" }}
            initial={{ width: 88, height: 88, opacity: 0.65 }}
            animate={{ width: 88 + (i === 0 ? 50 : 78), height: 88 + (i === 0 ? 50 : 78), opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>

      <motion.div
        className="absolute rounded-full"
        style={{ width: 88, height: 88 }}
        animate={{
          boxShadow: ringColor,
          scale:   isListening  ? [1, 1.05, 1] : 1,
          opacity: isProcessing ? [0.5, 1, 0.5] : 1,
        }}
        transition={{
          boxShadow: { duration: 0.45 },
          scale:   isListening  ? { duration: 2,   repeat: Infinity, ease: "easeInOut" } : { duration: 0.35 },
          opacity: isProcessing ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.35 },
        }}
      />

      <motion.div
        className="absolute rounded-full"
        style={{ width: 56, height: 56 }}
        animate={{
          background: isListening
            ? ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.22)", "rgba(255,255,255,0.14)"]
            : "rgba(255,255,255,0.07)",
        }}
        transition={
          isListening
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.45 }
        }
      />

      <motion.div
        className="rounded-full"
        style={{ background: "white" }}
        animate={{
          width:   isListening ? 10 : 9,
          height:  isListening ? 10 : 9,
          opacity: isListening ? 1 : 0.38,
        }}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function EventSetupInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const username     = searchParams.get("username") || "there";

  const addCalendarEvent = useCalendarStore((s) => s.addEvent);

  const [assistantState, setAssistantState] = useState<AssistantState>("awakening");
  const [step,        setStep]        = useState<ConversationStep>("event");
  const [data,        setData]        = useState<EventSetupData>({ ...EMPTY_DATA });
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [displayText, setDisplayText] = useState("");
  const [localTranscript, setLocalTranscript] = useState("");
  const [showWeather, setShowWeather] = useState(false);
  const [weather, setWeather]         = useState<WeatherResult | null>(null);

  // Stable refs for use inside async callbacks
  const stateRef      = useRef<AssistantState>("awakening");
  const stepRef       = useRef<ConversationStep>("event");
  const dataRef       = useRef<EventSetupData>({ ...EMPTY_DATA });
  const transcriptRef = useRef("");
  const twRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef        = useRef<MirrorSpeechRecognition | null>(null);

  useEffect(() => { stateRef.current = assistantState; }, [assistantState]);
  useEffect(() => { stepRef.current = step; },           [step]);
  useEffect(() => { dataRef.current = data; },           [data]);
  useEffect(() => { transcriptRef.current = localTranscript; }, [localTranscript]);

  // ── Typewriter ──
  function typewrite(text: string) {
    if (twRef.current) clearInterval(twRef.current);
    setDisplayText("");
    let i = 0;
    twRef.current = setInterval(() => {
      i++;
      setDisplayText(text.slice(0, i));
      if (i >= text.length) { clearInterval(twRef.current!); twRef.current = null; }
    }, 26);
  }

  // ── TTS ──
  function speak(text: string, onDone: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTimeout(onDone, 1200);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate  = 0.92;
    u.pitch = 1.0;
    u.onend   = onDone;
    u.onerror = () => setTimeout(onDone, 100);
    window.speechSynthesis.speak(u);
  }

  // ── Navigate to kiosk ──
  function finish() {
    setAssistantState("done");
    stateRef.current = "done";
    window.speechSynthesis?.cancel();
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setTimeout(() => router.push("/logged-in"), 600);
  }

  // ── Local mic (fallback when socket/ChatWonder is offline) ──
  function startLocalListening() {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setLocalTranscript("");
    transcriptRef.current = "";

    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setAssistantState("listening");
      stateRef.current = "listening";
      return;
    }

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = "en-US";

    rec.onresult = (e: MirrorSpeechEvent) => {
      const t = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join("");
      setLocalTranscript(t);
      transcriptRef.current = t;
    };

    rec.onend = () => {
      if (stateRef.current === "summary" || stateRef.current === "done") return;
      handleLocalAnswer(transcriptRef.current.trim());
    };

    rec.onerror = () => { /* swallow */ };
    recRef.current = rec;
    setAssistantState("listening");
    stateRef.current = "listening";
    rec.start();
  }

  // ── Local answer processing (fallback, no ChatWonder) ──
  function handleLocalAnswer(ans: string) {
    if (!ans || ans.split(" ").length < 2) {
      const retry = "I didn't catch that — could you say it again?";
      typewrite(retry);
      speak(retry, startLocalListening);
      setAssistantState("responding");
      stateRef.current = "responding";
      return;
    }

    const curStep = stepRef.current;
    const curData = { ...dataRef.current };

    setMessages((prev) => [...prev, { role: "user", text: ans }]);
    if (curStep === "event")      curData.eventName = ans;
    if (curStep === "event_type") curData.eventType = ans;
    if (curStep === "datetime")   curData.dateTime  = ans;
    if (curStep === "location")   curData.location  = ans;
    setData(curData);
    dataRef.current = curData;

    setAssistantState("processing");
    stateRef.current = "processing";
    setLocalTranscript("");
    transcriptRef.current = "";

    setTimeout(() => {
      const idx  = STEP_ORDER.indexOf(curStep);
      const next = STEP_ORDER[idx + 1] as ConversationStep;

      if (next === "weather") {
        const wp = getPrompt("weather", curData, username);
        setMessages((prev) => [...prev, { role: "assistant", text: wp }]);
        typewrite(wp);
        setAssistantState("responding");
        stateRef.current = "responding";
        setStep("weather");
        stepRef.current = "weather";
        speak(wp, () => {
          fetchWeather(curData.location).then((w) => {
            setWeather(w);
            setShowWeather(true);
            const cp = getPrompt("confirm", curData, username);
            setStep("confirm");
            stepRef.current = "confirm";
            setMessages((prev) => [...prev, { role: "assistant", text: cp }]);
            typewrite(cp);
            speak(cp, () => {
              setAssistantState("summary");
              stateRef.current = "summary";
            });
          });
        });
      } else {
        setStep(next);
        stepRef.current = next;
        const p = getPrompt(next, curData, username);
        setMessages((prev) => [...prev, { role: "assistant", text: p }]);
        typewrite(p);
        setAssistantState("responding");
        stateRef.current = "responding";
        speak(p, startLocalListening);
      }
    }, 900);
  }

  // ── ChatWonder action handler ──
  const handleChatWonderAction = useCallback((action: ChatWonderAction) => {
    if (action.type === "page_event") {
      const { event, payload } = action;

      if (event === "set_data") {
        const field = (payload as { field: string; value: string }).field;
        const value = (payload as { field: string; value: string }).value;
        setData((prev) => {
          const next = { ...prev, [field]: value };
          dataRef.current = next;
          return next;
        });
        setMessages((prev) => [...prev, { role: "user", text: value }]);
      }

      if (event === "set_step") {
        const s = (payload as { step: ConversationStep }).step;
        setStep(s);
        stepRef.current = s;
        if (s === "weather") setShowWeather(true);
        if (s === "confirm" || s === "summary" as string) {
          setAssistantState("summary");
          stateRef.current = "summary";
        }
      }

      if (event === "confirm") {
        finish();
      }
    }

    if (action.type === "calendar_save_event") {
      addCalendarEvent({
        title:     action.title,
        eventType: action.eventType,
        dateTime:  action.dateTime,
        location:  action.location,
      });
    }

    if (action.type === "maps_preview_location") {
      try {
        localStorage.setItem(
          "mirror_pending_map_location",
          JSON.stringify({ query: action.query, label: action.label }),
        );
      } catch {}
      router.push("/map");
    }

    if (action.type === "maps_get_directions") {
      try {
        localStorage.setItem(
          "mirror_pending_map_directions",
          JSON.stringify({ destination: action.destination, mode: action.mode ?? "driving" }),
        );
      } catch {}
      router.push("/map");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Register page context with VoiceProvider ──
  const pageContext = useMemo(() => ({
    route:         "/event-setup",
    pageName:      "event-setup",
    activeStep:    step,
    collectedData: data,
  }), [step, data]);

  useVoice(pageContext, handleChatWonderAction);

  // ── Boot sequence ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      const g = getPrompt("event", dataRef.current, username);
      setMessages([{ role: "assistant", text: g }]);
      typewrite(g);
      setAssistantState("responding");
      stateRef.current = "responding";
      speak(g, startLocalListening);
    }, 1500);
    return () => clearTimeout(t);
  }, []); // intentional empty deps — boot once

  // ── Summary confirmation listener (local fallback) ──
  useEffect(() => {
    if (assistantState !== "summary") return;
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;

    let active = true;
    const rec  = new SR();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = "en-US";

    rec.onresult = (e: MirrorSpeechEvent) => {
      const t = e.results[0][0].transcript.toLowerCase();
      if (/yes|sure|looks good|good|ok|okay|confirm|perfect|proceed/.test(t)) {
        finish();
      } else if (active) {
        try { rec.start(); } catch { /* ignore */ }
      }
    };
    rec.onerror = () => { /* swallow */ };

    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = rec;
    rec.start();

    return () => {
      active = false;
      try { rec.stop(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantState]);

  // ── Reset helper ──
  function resetFlow() {
    const empty = { ...EMPTY_DATA };
    setData(empty);
    dataRef.current = empty;
    setShowWeather(false);
    setMessages([]);
    setStep("event");
    stepRef.current = "event";
    setLocalTranscript("");
    transcriptRef.current = "";
    setAssistantState("awakening");
    stateRef.current = "awakening";
    setTimeout(() => {
      const g = getPrompt("event", empty, username);
      setMessages([{ role: "assistant", text: g }]);
      typewrite(g);
      setAssistantState("responding");
      stateRef.current = "responding";
      speak(g, startLocalListening);
    }, 400);
  }

  // ── Derived values ──
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

  const statusText =
    assistantState === "listening"  ? "Listening…"              :
    assistantState === "processing" ? "Thinking…"               :
    assistantState === "responding" ? "Speaking…"               :
    assistantState === "summary"    ? `Say "looks good" or tap` : "";

  const statusColor = assistantState === "listening" ? "#6b5b95" : "#9e93c8";

  const summaryRows = [
    data.eventName ? { icon: "🎉", label: "Occasion",   value: data.eventName } : null,
    data.eventType ? { icon: "👔", label: "Event Type", value: data.eventType } : null,
    data.dateTime  ? { icon: "📅", label: "Date & Time", value: data.dateTime }  : null,
    data.location  ? { icon: "📍", label: "Location",   value: data.location }  : null,
    showWeather && weather ? { icon: weather.icon, label: "Weather", value: `${weather.temp} · ${weather.condition}` } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  return (
    <motion.main
      className="relative w-screen h-screen overflow-hidden bg-linear-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca]"
      animate={{ opacity: assistantState === "done" ? 0 : 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <header
        className="absolute top-0 inset-x-0 z-20 pointer-events-none"
        style={{
          height: "var(--zone-header)",
          background: "linear-gradient(180deg, rgba(216,180,254,0.92) 0%, transparent 100%)",
        }}
      />

      {/* Main zone */}
      <div
        className="absolute inset-x-0 z-10 flex flex-col items-center justify-start px-10"
        style={{ top: "var(--zone-header)", height: "var(--zone-main)", paddingTop: "14%" }}
      >
        <AnimatePresence mode="wait">
          {assistantState !== "summary" ? (

            <motion.div
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center w-full"
            >
              <div style={{ minHeight: 28, marginBottom: 18 }}>
                <AnimatePresence>
                  {lastUserMsg && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 0.6, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-center font-medium"
                      style={{ fontSize: "22px", color: "#6b5b95" }}
                    >
                      {lastUserMsg.text}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <p
                className="font-semibold text-center"
                style={{ fontSize: "46px", maxWidth: 580, lineHeight: 1.3, marginBottom: 36, color: "#3d2f5f" }}
              >
                {displayText}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.85, repeat: Infinity }}
                  className="inline-block align-middle ml-1 rounded-sm"
                  style={{ width: 2, height: 32, background: "#a78bfa" }}
                />
              </p>

              <div style={{ marginBottom: 28 }}>
                <SoftRing state={assistantState} />
              </div>

              <div style={{ minHeight: 32 }}>
                <AnimatePresence>
                  {assistantState === "listening" && (
                    <motion.p
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.25 }}
                      className="text-center"
                      style={{ fontSize: "24px", maxWidth: 520, color: "#6b5b95" }}
                    >
                      {localTranscript || "Listening…"}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

          ) : (

            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="flex flex-col items-center w-full"
              style={{ maxWidth: 560 }}
            >
              <p
                className="font-semibold text-center"
                style={{ fontSize: "32px", marginBottom: 22, color: "#3d2f5f" }}
              >
                {displayText}
              </p>

              <div
                className="w-full"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.9)",
                  borderRadius: "28px",
                  boxShadow: "0 30px 80px rgba(107,91,149,0.18), 0 4px 16px rgba(107,91,149,0.08)",
                  overflow: "hidden",
                  marginBottom: "20px",
                }}
              >
                {summaryRows.map((row, i) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "20px 28px",
                      borderBottom: i < summaryRows.length - 1 ? "1px solid rgba(139,127,199,0.08)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "22px", width: 32, flexShrink: 0 }}>{row.icon}</span>
                    <div>
                      <p style={{ fontSize: "12px", color: "#9e93c8", marginBottom: 3, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {row.label}
                      </p>
                      <p style={{ fontSize: "20px", color: "#2d2d3a", fontWeight: 500 }}>{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={finish}
                className="w-full font-semibold text-white"
                style={{
                  background: "linear-gradient(to right, #a78bfa, #fb7185)",
                  boxShadow: "0 18px 50px rgba(168,85,247,0.28)",
                  borderRadius: "16px",
                  padding: "20px 0",
                  fontSize: "22px",
                  marginBottom: "14px",
                }}
              >
                Continue →
              </motion.button>

              <button
                onClick={resetFlow}
                className="w-full text-center font-medium"
                style={{ fontSize: "18px", color: "#6b5b95" }}
              >
                Edit
              </button>
            </motion.div>

          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer
        className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between px-12"
        style={{
          height: "var(--zone-footer)",
          borderTop: "1px solid rgba(107,91,149,0.1)",
          background: "linear-gradient(0deg, rgba(254,202,202,0.92) 0%, transparent 100%)",
        }}
      >
        <span className="font-medium" style={{ fontSize: "20px", color: statusColor }}>
          {statusText}
        </span>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={finish}
          className="font-medium"
          style={{ fontSize: "20px", color: "#6b5b95" }}
        >
          Skip
        </motion.button>
      </footer>
    </motion.main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventSetupPage() {
  return (
    <Suspense fallback={null}>
      <EventSetupInner />
    </Suspense>
  );
}
