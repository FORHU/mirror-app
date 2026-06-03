"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ChatWonderAction, PageContext } from "../ai/chatwonder.types";
import { mapService } from "@/modules/map/services/map.service";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { ROUTES } from "@/navigation";
import { AiEventsOverlay } from "./AiEventsOverlay";
import { motion, AnimatePresence } from "motion/react";
import { VoiceState } from "./types";
import { SYSTEM_RESPONSES } from "./responses";
import { runKernel } from "./orchestration/kernel";
import { executeAction } from "./orchestration/actionExecutor";
import { guardAction } from "./orchestration/actionGuard";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import {
  ConfirmationState,
  createIdleConfirmation,
  createPendingConfirmation,
  isExpired,
} from "./orchestration/confirmationState";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;
const CHAT_SESSION_KEY = "mirror_chat_session";

function float32ToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let n = 0; n < f.length; n++) {
    const c = Math.max(-1, Math.min(1, f[n]));
    out[n] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

export interface VoiceContextValue {
  voiceState: VoiceState;
  transcript: string;
  reply: string;
  error: string | null;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  toggle: () => void;
  startListening: () => void;
  stopListening: () => void;
  registerPage: (
    ctx: PageContext,
    onAction: (action: ChatWonderAction) => void,
  ) => void;
  unregisterPage: () => void;
  aiEvents: unknown[];
  chatHistory: Array<{ user: string; assistant: string }>;
  transcriptOpen: boolean;
  setTranscriptOpen: (v: boolean) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx)
    throw new Error("useVoiceContext must be used inside VoiceProvider");
  return ctx;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiEvents, setAiEvents] = useState<unknown[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<
    Array<{ user: string; assistant: string }>
  >([]);

  const confirmationRef = useRef<ConfirmationState>(createIdleConfirmation());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<Array<{ user: string; assistant: string }>>([]);
  const pageCtxRef = useRef<PageContext | null>(null);
  const onActionRef = useRef<((action: ChatWonderAction) => void) | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  // Auto-clear voice error after 5 seconds
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Hydrate the chat-wonder sessionId from sessionStorage so it survives page
  // reloads on non-Attract routes. Cleared only when arriving at /.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(CHAT_SESSION_KEY);
    if (stored) sessionIdRef.current = stored;
  }, []);

  // Reset pending state on route change
  useEffect(() => {
    confirmationRef.current = createIdleConfirmation();

    // Begin a fresh chat-wonder Voice session on arrival at the Attract screen.
    // Auth, kiosk pairing, and gender are cleared by their own owners (see ADR 0001).
    if (pathname === ROUTES.WELCOME) {
      sessionIdRef.current = undefined;
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      historyRef.current = [];
      queueMicrotask(() => setChatHistory([]));
    }
  }, [pathname]);

  // ----------------------

  const stopPlayback = () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
  };

  const cleanupRecording = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  };

  const startListening = useCallback(async () => {
    if (voiceState !== "idle") return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const source = ctx.createMediaStreamSource(stream);

      chunksRef.current = [];
      processor.onaudioprocess = (e) => {
        chunksRef.current.push(float32ToInt16(e.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioCtxRef.current = ctx;
      processorRef.current = processor;
      sourceRef.current = source;
      streamRef.current = stream;
      setVoiceState("recording");
    } catch {
      setError("Microphone access denied.");
    }
  }, [voiceState]);

  const stopListening = useCallback(async () => {
    if (voiceState !== "recording") return;
    setVoiceState("processing");

    const chunks = chunksRef.current;
    cleanupRecording();

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const combined = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.length;
    }

    try {
      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation;
      const now = new Date();

      const upcoming = useCalendarStore
        .getState()
        .events.filter((e) => new Date(e.dateTime) >= now)
        .sort(
          (a, b) =>
            new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
        )
        .slice(0, 3);

      const schedules = upcoming.length
        ? upcoming
            .map(
              (e) =>
                `${e.title} @ ${e.location} on ${new Date(e.dateTime).toLocaleDateString()}`,
            )
            .join("; ")
        : "No upcoming events";

      const ctx = {
        lat: loc?.lat,
        lng: loc?.lng,
        trafficEnabled: map.showTraffic,
        isRouteActive: !!map.activeRoute,
        profile: map.activeProfile,
        routeDistance: map.activeRoute ? map.routeDistance : undefined,
        routeDuration: map.activeRoute ? map.routeDuration : undefined,
        destinationName:
          map.selectedDestination?.name ??
          map.selectedDestination?.address ??
          undefined,
        currentTime: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        currentDate: now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        schedules,
        // Send the actual route (always current via usePathname) so the AI has
        // an unambiguous, never-stale source of truth for where the user is.
        // The friendly pageName is appended only as a hint.
        currentPage: pageCtxRef.current?.pageName
          ? `${pathname} (${pageCtxRef.current.pageName})`
          : pathname,
        userOutlineId: useOutlineStore.getState().outlineId ?? undefined,
        sessionId: sessionIdRef.current,
        language: useMirrorStore.getState().voiceLanguage,
        gender:
          useAuthStore.getState().user?.gender ??
          sessionStorage.getItem("mirror_gender") ??
          undefined,
      };

      const language = useMirrorStore.getState().voiceLanguage;
      const t = await mapService.transcribe(combined.buffer, language);
      setTranscript(t);

      if (!t || t.trim() === "") {
        setVoiceState("idle");
        return;
      }

      // Garment mode: bypass the orchestration pipeline, route to chatWonderService
      if (pageCtxRef.current?.mode === "garment") {
        let weather: Record<string, unknown> | undefined;
        if (loc) {
          try {
            const res = await fetch(`/api/mirror/weather?lat=${loc.lat}&lng=${loc.lng}`);
            if (res.ok) {
              const json = await res.json();
              const d = json.data ?? json;
              weather = {
                date: new Date().toISOString().split("T")[0],
                description: String(d.condition ?? "").toLowerCase(),
                estimated: false,
                is_cold: Number(d.temperature) < 20,
                is_hot: Number(d.temperature) >= 30,
                is_rainy: Number(d.precipitationProb) >= 50 || String(d.condition ?? "").toLowerCase().includes("rain"),
                lat: loc.lat,
                lon: loc.lng,
                temperature_c: Number(d.temperature),
              };
            }
          } catch { /* weather is best-effort */ }
        }
        const garmentResponse = await chatWonderService.message(
          { input: `[garment] ${t}`, ...(weather ? { weather } : {}) },
        );
        setReply(garmentResponse.message);
        const newHistory = [...historyRef.current, { user: t, assistant: garmentResponse.message }].slice(-4);
        historyRef.current = newHistory;
        setChatHistory(newHistory);
        setVoiceState("idle");
        onActionRef.current?.({ type: "GARMENT_RECOMMENDATION", response: garmentResponse });
        return;
      }

      let r = "";
      let events: unknown[] = [];
      let audioBuffer: ArrayBuffer | null = null;
      let bypassMainExecution = false;

      // PRE-PROCESSOR LAYER — fast local yes/no confirmation check
      if (confirmationRef.current.state === "PENDING") {
        if (isExpired(confirmationRef.current)) {
          confirmationRef.current = createIdleConfirmation();
        } else {
          const lower = t.toLowerCase();
          const isYes =
            /\b(yes|yeah|yep|sure|ok|okay|go ahead|confirm|oui|ne|da)\b/i.test(
              lower,
            );
          const isNo =
            /\b(no|nope|cancel|stop|wait|nevermind|non|aniyo)\b/i.test(lower);
          const isHighIntent =
            /\b(actually|instead|show me|take me to|navigate to|en fait)\b/i.test(
              lower,
            );

          if (isHighIntent) {
            // Override: user gave a strong new command — clear pending and fall through to AI
            confirmationRef.current = createIdleConfirmation();
          } else if (isYes) {
            const actionToRun = confirmationRef.current.action;
            confirmationRef.current = createIdleConfirmation();

            // Re-check the guard on confirmation. Block rules still apply
            // (e.g. NEEDS_GENDER) even after the user said yes.
            const guard = guardAction(actionToRun, pathname);
            if (guard.allowed && guard.action) {
              await executeAction(
                guard.action,
                router,
                pathname,
                onActionRef.current ?? undefined,
              );
              r = SYSTEM_RESPONSES.defaultOpen;
            } else {
              r = guard.reply ?? SYSTEM_RESPONSES.cancelled;
            }
            audioBuffer = await mapService.tts(r);
            bypassMainExecution = true;
          } else if (isNo) {
            confirmationRef.current = createIdleConfirmation();
            r = SYSTEM_RESPONSES.cancelled;
            audioBuffer = await mapService.tts(r);
            bypassMainExecution = true;
          } else {
            // UNCERTAIN — pass mode flag so AI knows to ask for clarification
            (ctx as Record<string, unknown>).mode = "confirm_context_required";
          }
        }
      }

      if (!bypassMainExecution) {
        // COGNITIVE AI PIPELINE
        const res = await mapService.ask(t, ctx, language);
        r = res.reply;
        events = res.events ?? [];
        audioBuffer = res.audio;
        if (res.sessionId) {
          sessionIdRef.current = res.sessionId;
          sessionStorage.setItem(CHAT_SESSION_KEY, res.sessionId);
        }

        const cogAction = res.action as
          | ({
              type: string;
              payload?: Record<string, unknown>;
            } & Record<string, unknown>)
          | null;
        let chatAction: ChatWonderAction | null = null;

        if (cogAction) {
          const { type, payload, ...rest } = cogAction;
          chatAction = {
            type,
            ...(payload ?? {}),
            ...rest,
          } as ChatWonderAction;
        }

        // Server-driven confirmation takes precedence: if the cognitive
        // service flagged this action as requiring confirmation, store it as
        // pending and DO NOT execute. The TTS reply already asks the user.
        if (chatAction && res.requiresConfirmation) {
          confirmationRef.current = createPendingConfirmation(chatAction, r);
        } else {
          // 🧠 RUN UI KERNEL
          const result = await runKernel(
            chatAction,
            pathname,
            router,
            onActionRef.current ?? undefined,
          );

          if (result.requiresConfirmation && result.action) {
            confirmationRef.current = createPendingConfirmation(
              result.action,
              result.reply || r,
            );
            r = result.reply || r;
            audioBuffer = await mapService.tts(r);
          } else if (result.reply) {
            // If the kernel intercepted with a custom reply (e.g. Gender Guard)
            r = result.reply;
            audioBuffer = await mapService.tts(r);
          }
        }
      }

      setReply(r);
      setAiEvents(events || []);
      const newHistory = [
        ...historyRef.current,
        { user: t, assistant: r },
      ].slice(-4);
      historyRef.current = newHistory;
      setChatHistory(newHistory);
      setVoiceState("speaking");

      if (audioBuffer) {
        const playCtx = new AudioContext();
        playbackCtxRef.current = playCtx;
        const decoded = await playCtx.decodeAudioData(audioBuffer.slice(0));
        const src = playCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(playCtx.destination);
        playbackRef.current = src;

        src.onended = () => {
          stopPlayback();
          setVoiceState("idle");
        };
        src.start(0);
      } else {
        setVoiceState("idle");
      }
    } catch (err: unknown) {
      const apiErrorMsg =
        (err as { response?: { data?: { error?: string; message?: string } } })
          ?.response?.data?.error ||
        (err as { response?: { data?: { error?: string; message?: string } } })
          ?.response?.data?.message;
      setError(
        apiErrorMsg ||
          (err instanceof Error ? err.message : "Voice processing failed."),
      );
      setVoiceState("idle");
    }
  }, [voiceState, pathname, router]);

  const toggle = useCallback(() => {
    if (voiceState === "idle") return startListening();
    if (voiceState === "recording") return stopListening();
    if (voiceState === "speaking") {
      stopPlayback();
      setTranscript("");
      setReply("");
      setError(null);
      setVoiceState("idle");
    }
  }, [voiceState, startListening, stopListening]);

  const registerPage = useCallback(
    (ctx: PageContext, onAction: (action: ChatWonderAction) => void) => {
      pageCtxRef.current = ctx;
      onActionRef.current = onAction;
    },
    [],
  );

  const unregisterPage = useCallback(() => {
    pageCtxRef.current = null;
    onActionRef.current = null;
  }, []);

  const isListening = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";

  return (
    <VoiceContext.Provider
      value={{
        voiceState,
        transcript,
        reply,
        error,
        isListening,
        isProcessing,
        isSpeaking,
        toggle,
        startListening,
        stopListening,
        registerPage,
        unregisterPage,
        aiEvents,
        chatHistory,
        transcriptOpen,
        setTranscriptOpen,
      }}
    >
      {children}
      <AnimatePresence>
        {error && (
          <motion.div
            className="fixed top-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl"
            style={{
              background: "rgba(220,38,38,0.9)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <p className="text-white text-sm font-medium tracking-wide">
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <AiEventsOverlay />
    </VoiceContext.Provider>
  );
}
