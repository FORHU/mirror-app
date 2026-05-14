"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getSocketClient } from "../socket/socket-client";
import {
  CHATWONDER_INPUT,
  CHATWONDER_RESPONSE,
} from "../socket/socket-events";
import type {
  ChatWonderAction,
  ChatWonderResponse,
  PageContext,
} from "../ai/chatwonder.types";

// ─── Speech API shim ──────────────────────────────────────────────────────────

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
    SpeechRecognition:       new () => MirrorSpeechRecognition;
    webkitSpeechRecognition: new () => MirrorSpeechRecognition;
  }
}

// ─── Context shape ────────────────────────────────────────────────────────────

export interface VoiceContextValue {
  isListening:    boolean;
  transcript:     string;
  startListening: () => void;
  stopListening:  () => void;
  /** Called by the active page to register its context and action handler. */
  registerPage:   (ctx: PageContext, onAction: (action: ChatWonderAction) => void) => void;
  unregisterPage: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceContext must be used inside VoiceProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [isListening, setIsListening] = useState(false);
  const [transcript,  setTranscript]  = useState("");

  const recRef         = useRef<MirrorSpeechRecognition | null>(null);
  const transcriptRef  = useRef("");
  const pageCtxRef     = useRef<PageContext | null>(null);
  const onActionRef    = useRef<((action: ChatWonderAction) => void) | null>(null);

  // ── Keep transcript ref in sync ──
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // ── Socket: listen for ChatWonder responses ──
  useEffect(() => {
    const socket = getSocketClient();

    function handleResponse(payload: ChatWonderResponse) {
      // Speak the AI's response
      if (payload.speech && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(payload.speech);
        u.rate = 0.92;
        window.speechSynthesis.speak(u);
      }

      // Dispatch action
      if (payload.action) {
        const action = payload.action;
        if (action.type === "navigate") {
          router.push(action.route);
        } else if (action.type === "speak") {
          // already spoken above; no-op
        } else {
          // page_event, calendar_save_event, maps_preview_location, maps_get_directions
          onActionRef.current?.(action);
        }
      }
    }

    socket.on(CHATWONDER_RESPONSE, handleResponse);
    return () => { socket.off(CHATWONDER_RESPONSE, handleResponse); };
  }, [router]);

  // ── Send transcript to ChatWonder via socket ──
  const sendToAI = useCallback((text: string) => {
    if (!text.trim()) return;
    const socket = getSocketClient();
    if (!socket.connected) return;
    socket.emit(CHATWONDER_INPUT, {
      transcript:  text.trim(),
      pageContext: pageCtxRef.current ?? { route: "/", pageName: "unknown" },
    });
  }, []);

  // ── Start listening ──
  const startListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setTranscript("");
    transcriptRef.current = "";

    const SR = typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SR) {
      setIsListening(true);
      return;
    }

    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = "en-US";

    rec.onresult = (e: MirrorSpeechEvent) => {
      const t = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i][0].transcript,
      ).join("");
      setTranscript(t);
      transcriptRef.current = t;
    };

    rec.onend = () => {
      setIsListening(false);
      sendToAI(transcriptRef.current);
    };

    rec.onerror = () => { setIsListening(false); };

    recRef.current = rec;
    setIsListening(true);
    rec.start();
  }, [sendToAI]);

  // ── Stop listening ──
  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  // ── Page registration ──
  const registerPage = useCallback(
    (ctx: PageContext, onAction: (action: ChatWonderAction) => void) => {
      pageCtxRef.current  = ctx;
      onActionRef.current = onAction;
    },
    [],
  );

  const unregisterPage = useCallback(() => {
    pageCtxRef.current  = null;
    onActionRef.current = null;
  }, []);

  return (
    <VoiceContext.Provider
      value={{ isListening, transcript, startListening, stopListening, registerPage, unregisterPage }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
