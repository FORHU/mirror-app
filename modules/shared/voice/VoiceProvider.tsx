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
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { ROUTES, SITEMAP_CONTEXT } from "@/navigation";
import { concatFrames, float32ToInt16, transcribeAudio } from "./submitAudio";
import { OVERVIEW_PROMPT_KEY } from "@/modules/overview";
import { AiEventsOverlay } from "./AiEventsOverlay";
import { motion, AnimatePresence } from "motion/react";
import { VoiceState } from "./types";
import { SYSTEM_RESPONSES } from "./responses";
import { runKernel } from "./orchestration/kernel";
import { handleStylistTarget } from "./sessionCommands";
import { executeAction } from "./orchestration/actionExecutor";
import { guardAction } from "./orchestration/actionGuard";
import {
  chatWonderService,
  resolveAccessToken,
} from "@/modules/shared/api/chat-wonder.service";
import { stopAllAudioQueues } from "./audioQueue";

// ── Amazon Polly TTS ──────────────────────────────────────────────────────────
// Calls /api/mirror/voice/tts which synthesises speech directly via AWS Polly.
async function pollyTts(text: string): Promise<ArrayBuffer> {
  const lang = useMirrorStore.getState().voiceLanguage ?? "en-US";
  const res = await fetch("/api/mirror/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error(`Polly TTS failed: ${res.status}`);
  return res.arrayBuffer();
}
import { COSMETIC_PROMPT_KEY } from "@/modules/cosmetics/constants";
import { FASHION_PROMPT_KEY } from "@/modules/fashion/constants";
import {
  ConfirmationState,
  createIdleConfirmation,
  createPendingConfirmation,
  isExpired,
} from "./orchestration/confirmationState";
import { useWeather } from "@/modules/shared/hooks/useWeather";

const CHAT_SESSION_KEY = "mirror_chat_session";
// Safety cap: without VAD the mic only stops on a tap, so auto-stop & submit a
// runaway recording (user walked away) instead of buffering audio forever.
const MAX_RECORDING_MS = 45_000;
const AI_ASSISTANT_WAKE_ONLY =
  /^(?:(?:hey|hay|hi|ok|okay|hello|magic)\s+)?(?:mirror|miror|mira|miro|mere|nero|meera|mirror\s+mirror)$/i;

const COSMETIC_SELECTION_WORDS: Record<string, number> = {
  first: 1,
  one: 1,
  second: 2,
  two: 2,
  third: 3,
  three: 3,
  fourth: 4,
  four: 4,
  fifth: 5,
  five: 5,
  sixth: 6,
  six: 6,
  seventh: 7,
  seven: 7,
  eighth: 8,
  eight: 8,
  ninth: 9,
  nine: 9,
  tenth: 10,
  ten: 10,
};

function extractCosmeticSelectionRank(text: string): number | null {
  const lower = text.toLowerCase().replace(/[^\w\s#-]/g, " ");
  const wantsSelection =
    /\b(select|choose|pick|open|show|view|see|tap|highlight|go|navigate|see)\b/.test(
      lower,
    );
  if (!wantsSelection) return null;

  const numeric = lower.match(
    /(?:#\s*(\d{1,2})\b|\b(?:image|product|item|recommendation|option|number|no)\s*(?:number|#)?\s*(\d{1,2})\b)/,
  );
  if (numeric) {
    const rank = Number(numeric[1] ?? numeric[2]);
    return rank >= 1 && rank <= 10 ? rank : null;
  }

  const wordPattern = Object.keys(COSMETIC_SELECTION_WORDS).join("|");
  const targetedWord = lower.match(
    new RegExp(
      `\\b(?:image|product|item|recommendation|option|number|the)\\s+(${wordPattern})\\b`,
    ),
  );
  const looseWord =
    targetedWord ?? lower.match(new RegExp(`\\b(${wordPattern})\\b`));
  if (!looseWord) return null;

  return COSMETIC_SELECTION_WORDS[looseWord[1]] ?? null;
}

// Spoken number forms + ASR homophones — used in context-bound patterns only to avoid false positives
const SPOKEN_IDX: Record<string, number> = {
  one: 0,
  won: 0,
  two: 1,
  to: 1,
  too: 1,
  three: 2,
  four: 3,
  for: 3,
  five: 4,
  six: 5,
};
const SPOKEN_IDX_PAT = Object.keys(SPOKEN_IDX).join("|");

function parseSpokenIdx(raw: string): number | null {
  if (raw in SPOKEN_IDX) return SPOKEN_IDX[raw];
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n - 1 : null;
}

// Ordinal/cardinal words for the loose match — no homophones to prevent false positives
const FASHION_OUTFIT_SELECTION_WORDS: Record<string, number> = {
  first: 0,
  one: 0,
  second: 1,
  two: 1,
  third: 2,
  three: 2,
  fourth: 3,
  four: 3,
};

function extractFashionOutfitSelection(text: string): number | null {
  const lower = text.toLowerCase().replace(/[^\w\s#-]/g, " ");
  const wantsSelection =
    /\b(select|choose|pick|show|view|see|open|switch)\b/.test(lower);
  if (!wantsSelection) return null;

  // "outfit [number/#]? [digit|spoken|homophone]" — slot context makes homophones safe
  const numericOutfit = lower.match(
    new RegExp(`\\boutfit\\s*(?:number|#)?\\s*(\\d{1,2}|${SPOKEN_IDX_PAT})\\b`),
  );
  if (numericOutfit) {
    const idx = parseSpokenIdx(numericOutfit[1]);
    return idx !== null && idx <= 9 ? idx : null;
  }

  const numericPlain = lower.match(
    /(?:#\s*(\d{1,2})\b|\b(?:number|no|option|item)\s+(\d{1,2})\b)/,
  );
  if (numericPlain) {
    const idx = Number(numericPlain[1] ?? numericPlain[2]) - 1;
    return idx >= 0 && idx <= 9 ? idx : null;
  }

  const wordPattern = Object.keys(FASHION_OUTFIT_SELECTION_WORDS).join("|");
  const wordMatch = lower.match(new RegExp(`\\b(${wordPattern})\\b`));
  if (wordMatch) {
    const idx = FASHION_OUTFIT_SELECTION_WORDS[wordMatch[1]];
    return idx !== undefined ? idx : null;
  }

  return null;
}

type GarmentSlot = "base" | "mid" | "outer" | "bottoms" | "shoes" | "bags";

const GARMENT_SLOT_WORDS: Record<string, GarmentSlot> = {
  base: "base",
  mid: "mid",
  middle: "mid",
  outer: "outer",
  bottom: "bottoms",
  bottoms: "bottoms",
  lower: "bottoms",
  shoe: "shoes",
  shoes: "shoes",
  bag: "bags",
  bags: "bags",
};

function cleanMessage(text: string): string {
  const cut = text.indexOf("\n\n");
  return (cut !== -1 ? text.slice(0, cut) : text).trim();
}

function firstNSentences(text: string, n: number): string {
  const re = /[^.!?]*[.!?]+/g;
  const sentences: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && sentences.length < n) {
    sentences.push(m[0]);
  }
  return sentences.length > 0 ? sentences.join("").trim() : text.trim();
}

function extractFashionGarmentSelection(
  text: string,
): { slot: GarmentSlot; index: number } | null {
  const lower = text.toLowerCase().replace(/[^\w\s#-]/g, " ");
  const wantsSelection =
    /\b(select|choose|pick|show|view|see|open|switch)\b/.test(lower);
  if (!wantsSelection) return null;

  const slotPat = Object.keys(GARMENT_SLOT_WORDS).join("|");
  // "slot [number/#]? [digit|spoken|homophone]" — slot keyword bounds the number so homophones are safe
  const match = lower.match(
    new RegExp(
      `\\b(${slotPat})\\s+(?:number|#)?\\s*(\\d{1,2}|${SPOKEN_IDX_PAT})\\b`,
    ),
  );
  if (!match) return null;

  const slot = GARMENT_SLOT_WORDS[match[1]];
  const idx = parseSpokenIdx(match[2]);
  if (!slot || idx === null || idx > 9) return null;
  return { slot, index: idx };
}

import {
  isFashionHandoffPrompt,
  hasFashionContext,
  isCosmeticHandoffPrompt,
  isLifestylePrompt,
  isNavigationPhrase,
} from "./voiceHandoff";

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
  submitText: (text: string) => Promise<void>;
  speakText: (text: string) => Promise<void>;
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

  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);

  const historyRef = useRef<Array<{ user: string; assistant: string }>>([]);

  useEffect(() => {
    router.prefetch(ROUTES.OVERVIEW);
    router.prefetch(ROUTES.AI_RECOMMENDATION_COSMETIC);
    router.prefetch(ROUTES.AI_RECOMMENDATION_FASHION);
  }, [router]);
  const pageCtxRef = useRef<PageContext | null>(null);
  const onActionRef = useRef<((action: ChatWonderAction) => void) | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const { weather } = useWeather();
  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);
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

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
  }, []);

  // Tear down the mic stream/graph and stop collecting frames. Safe to call
  // when nothing is recording. (Refs are stable, so no deps needed.)
  const stopMicCapture = useCallback(() => {
    isRecordingRef.current = false;
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    void audioCtxRef.current?.close().catch(() => {});
    processorRef.current = null;
    mediaStreamRef.current = null;
    audioCtxRef.current = null;
    speechFramesRef.current = [];
  }, []);

  // Reset pending state on route change
  useEffect(() => {
    confirmationRef.current = createIdleConfirmation();

    // On arrival at the Attract screen, kill any in-flight audio and start a
    // fresh chat-wonder session. Auth/gender cleared by their own owners (ADR 0001).
    if (pathname === ROUTES.AI_ASSISTANT) {
      stopPlayback();
      stopMicCapture();
      queueMicrotask(() => setVoiceState("idle"));
      sessionIdRef.current = undefined;
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      historyRef.current = [];
      queueMicrotask(() => setChatHistory([]));
    }
  }, [pathname, stopPlayback, stopMicCapture]);

  const speakText = useCallback(
    async (text: string): Promise<void> => {
      const t = text?.trim();
      if (!t) return;
      stopPlayback();
      const audio = await pollyTts(t).catch(() => null);
      if (!audio) {
        setVoiceState("idle");
        return;
      }
      setVoiceState("speaking");
      const playCtx = new AudioContext();
      playbackCtxRef.current = playCtx;
      const decoded = await playCtx.decodeAudioData(audio.slice(0));
      const src = playCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(playCtx.destination);
      playbackRef.current = src;
      await new Promise<void>((resolve) => {
        src.onended = () => {
          stopPlayback();
          setVoiceState("idle");
          resolve();
        };
        src.start(0);
      });
    },
    [stopPlayback],
  );

  // Stop any in-flight reply audio when the route changes, so a previous page's
  // spoken reply (e.g. the /ai-assistant answer that triggered navigation) does
  // not keep playing — or overlap new audio — once you land on the next page.
  // Also stop the mic and reset voiceState so the mic is always usable on the
  // new page, even if navigation interrupted a recording/processing cycle.
  useEffect(() => {
    stopPlayback();
    stopAllAudioQueues();
    stopMicCapture();
    queueMicrotask(() => setVoiceState("idle"));
  }, [pathname, stopPlayback, stopMicCapture]);

  const handleAIAssistantText = useCallback(
    async (t: string) => {
      if (AI_ASSISTANT_WAKE_ONLY.test(t.trim())) {
        setTranscript("");
        setReply("");
        setVoiceState("idle");
        return;
      }

      // Explicit "navigate / go / take me to <section>" — resolve the destination
      // immediately without an API round-trip, then speak a short confirmation and
      // navigate. This avoids the 10-20 s ChatWonder latency for unambiguous
      // navigation intents like "Navigate me to Maps".
      if (isNavigationPhrase(t)) {
        const lc = t.toLowerCase();

        let target: string | null = null;
        let assistantReply: string | null = null;

        if (/\b(fashion|outfit|outfits|style|clothing|wardrobe)\b/.test(lc)) {
          target = ROUTES.AI_RECOMMENDATION_FASHION;
          assistantReply = "Opening fashion recommendations.";
        } else if (
          /\b(cosmetic|cosmetics|skincare|skin care|skin|product|products)\b/.test(
            lc,
          )
        ) {
          target = ROUTES.AI_RECOMMENDATION_COSMETIC;
          assistantReply = "Opening cosmetic recommendations.";
        } else if (/\b(overview|home|dashboard)\b/.test(lc)) {
          target = ROUTES.OVERVIEW;
          assistantReply = "Taking you to the overview.";
        }

        if (target && assistantReply) {
          setReply(assistantReply);
          const newHistory = [
            ...historyRef.current,
            { user: t, assistant: assistantReply },
          ];
          historyRef.current = newHistory;
          setChatHistory(newHistory);
          // Intentionally no sessionStorage write here — the transcript is a
          // navigation command ("Navigate me to X"), not a meaningful query for
          // the target page. Writing it would cause pages to auto-run it as an
          // AI query on mount.
          await speakText(assistantReply);
          router.push(target);
          return;
        }
        // Unknown destination — fall through to the AI API
      }

      if (isLifestylePrompt(t) && !isNavigationPhrase(t)) {
        const assistantReply =
          "Pulling together your outfit, skincare, and places to explore.";
        setReply(assistantReply);
        const newHistory = [
          ...historyRef.current,
          { user: t, assistant: assistantReply },
        ];
        historyRef.current = newHistory;
        setChatHistory(newHistory);
        try {
          sessionStorage.setItem(OVERVIEW_PROMPT_KEY, t);
        } catch {
          /* prompt handoff is best-effort */
        }
        await speakText(assistantReply);
        router.push(ROUTES.OVERVIEW);
        return;
      }

      if (isFashionHandoffPrompt(t) && !isNavigationPhrase(t)) {
        // Without any context (occasion, time, weather, style, color) the
        // recommendation page has nothing to work with — ask for details
        // instead of navigating.
        if (!hasFashionContext(t)) {
          const askReply =
            "Happy to style you! What's the occasion — and when or where are you headed?";
          setReply(askReply);
          const newHistory = [
            ...historyRef.current,
            { user: t, assistant: askReply },
          ];
          historyRef.current = newHistory;
          setChatHistory(newHistory);
          await speakText(askReply);
          return;
        }
        const assistantReply =
          "Opening fashion recommendations for your outfit.";
        setReply(assistantReply);
        const newHistory = [
          ...historyRef.current,
          { user: t, assistant: assistantReply },
        ];
        historyRef.current = newHistory;
        setChatHistory(newHistory);
        try {
          sessionStorage.setItem(FASHION_PROMPT_KEY, t);
        } catch {
          /* prompt handoff is best-effort */
        }
        await speakText(assistantReply);
        router.push(ROUTES.AI_RECOMMENDATION_FASHION);
        return;
      }

      if (isCosmeticHandoffPrompt(t) && !isNavigationPhrase(t)) {
        const assistantReply =
          "Opening cosmetic recommendations while I find products for you.";
        setReply(assistantReply);
        const newHistory = [
          ...historyRef.current,
          { user: t, assistant: assistantReply },
        ];
        historyRef.current = newHistory;
        setChatHistory(newHistory);
        useMirrorStore.getState().setPendingCosmeticsData(null);
        useMirrorStore.getState().setChatCosmeticsData(null);
        try {
          sessionStorage.setItem(COSMETIC_PROMPT_KEY, t);
        } catch {
          /* prompt handoff is best-effort */
        }
        await speakText(assistantReply);
        router.push(ROUTES.AI_RECOMMENDATION_COSMETIC);
        return;
      }

      const history = historyRef.current
        .flatMap((h) => [
          { role: "user" as const, content: h.user },
          { role: "assistant" as const, content: h.assistant },
        ])
        .slice(-10);

      const token = await resolveAccessToken();
      const assistantRes = await fetch("/api/mirror/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-platform": "kiosk",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: t, history }),
      });

      const data = (await assistantRes.json().catch(() => null)) as {
        reply?: string;
        route?: string | null;
      } | null;
      const assistantReply =
        data?.reply ??
        (assistantRes.ok
          ? "I'm not sure how to help with that."
          : "Sorry, something went wrong.");

      setReply(assistantReply);
      const newHistory = [
        ...historyRef.current,
        { user: t, assistant: assistantReply },
      ];
      historyRef.current = newHistory;
      setChatHistory(newHistory);

      // Write prompt handoff keys before playing TTS so the target page reads
      // them in sessionStorage the moment it mounts after navigation.
      if (data?.route === ROUTES.OVERVIEW) {
        try {
          sessionStorage.setItem(OVERVIEW_PROMPT_KEY, t);
        } catch {
          /* overview just won't auto-fire */
        }
      }
      const pendingRoute = data?.route ?? null;

      const finish = () => {
        setVoiceState("idle");
        // Navigate AFTER TTS ends so voiceState is already "idle" when the
        // target page mounts. This prevents submitText from being rejected by
        // the voiceState !== "idle" guard in the handoff effect.
        if (pendingRoute) router.push(pendingRoute);
      };

      const audio = await pollyTts(assistantReply).catch(() => null);
      if (!audio) {
        finish();
        return;
      }

      setVoiceState("speaking");
      const playCtx = new AudioContext();
      playbackCtxRef.current = playCtx;
      const decoded = await playCtx.decodeAudioData(audio.slice(0));
      const src = playCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(playCtx.destination);
      playbackRef.current = src;
      src.onended = () => {
        stopPlayback();
        finish();
      };
      src.start(0);
    },
    [router, stopPlayback, speakText],
  );

  // Tap-to-talk mic capture: tap to start recording, tap again to stop & submit.
  const isRecordingRef = useRef(false);
  const micInitializingRef = useRef(false);
  const speechFramesRef = useRef<Float32Array[]>([]);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Holds the latest stopListening so the max-recording timer can invoke it
  // without a forward-reference (stopListening is defined further down).
  const stopListeningRef = useRef<(() => void) | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const submitAudioRef = useRef<
    ((frames: Float32Array[]) => Promise<void>) | null
  >(null);
  const processTranscript = useCallback(
    async (t: string) => {
      stopPlayback();
      stopAllAudioQueues();
      setTranscript(t);

      try {
        // ── Vague fashion gate ──────────────────────────────────────────────────
        // Fashion prompts without any context (occasion, time, weather, style,
        // color) give the recommendation page nothing to work with — ask for
        // details instead of letting the stylist navigate there. Skipped when
        // already on the fashion page, where no navigation is involved.
        if (
          isFashionHandoffPrompt(t) &&
          !isNavigationPhrase(t) &&
          !hasFashionContext(t) &&
          !pathname.startsWith(ROUTES.AI_RECOMMENDATION_FASHION)
        ) {
          const askReply =
            "Happy to style you! What's the occasion — and when or where are you headed?";
          setReply(askReply);
          historyRef.current = [
            ...historyRef.current,
            { user: t, assistant: askReply },
          ];
          setChatHistory(historyRef.current);
          await speakText(askReply);
          return;
        }
        // ── End vague fashion gate ──────────────────────────────────────────────

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
          currentPage: pageCtxRef.current?.pageName
            ? `${pathname} (${pageCtxRef.current.pageName})`
            : pathname,
          userOutlineId: useOutlineStore.getState().outlineId ?? undefined,
          sessionId: sessionIdRef.current,
          language: useMirrorStore.getState().voiceLanguage,
          gender:
            useAuthStore.getState().user?.gender ||
            sessionStorage.getItem("mirror_gender") ||
            undefined,
        };

        if (!t || t.trim() === "") {
          setVoiceState("idle");
          return;
        }

        // Garment and Cosmetics mode: bypass the orchestration pipeline, route to chatWonderService
        const pageMode = pageCtxRef.current?.mode;
        const wantsDirectNavigation = isNavigationPhrase(t);

        if (
          !wantsDirectNavigation &&
          (pageMode === "garment" ||
            pageMode === "cosmetics" ||
            pageMode === "overview" ||
            pageCtxRef.current?.route?.includes("ai-recommendation-cosmetic"))
        ) {
          const isCosmeticsRequest =
            isCosmeticHandoffPrompt(t) && !wantsDirectNavigation;
          const isCosmetics =
            isCosmeticsRequest ||
            pageMode === "cosmetics" ||
            pageCtxRef.current?.route?.includes("ai-recommendation-cosmetic");

          const selectionRank = isCosmetics
            ? extractCosmeticSelectionRank(t)
            : null;
          if (selectionRank) {
            onActionRef.current?.({
              type: "cosmetic_select_recommendation",
              rank: selectionRank,
            });
            const localReply = `Showing recommendation number ${selectionRank}.`;
            setReply(localReply);
            const newHistory = [
              ...historyRef.current,
              { user: t, assistant: localReply },
            ];
            historyRef.current = newHistory;
            setChatHistory(newHistory);
            setVoiceState("idle");
            return;
          }

          const outfitIdx =
            !isCosmetics && pageMode === "garment"
              ? extractFashionOutfitSelection(t)
              : null;
          if (outfitIdx !== null) {
            onActionRef.current?.({
              type: "fashion_select_outfit",
              index: outfitIdx,
            });
            const localReply = `Showing outfit number ${outfitIdx + 1}.`;
            setReply(localReply);
            const newHistory = [
              ...historyRef.current,
              { user: t, assistant: localReply },
            ];
            historyRef.current = newHistory;
            setChatHistory(newHistory);
            setVoiceState("idle");
            return;
          }

          const garmentSel =
            !isCosmetics && pageMode === "garment"
              ? extractFashionGarmentSelection(t)
              : null;
          if (garmentSel !== null) {
            onActionRef.current?.({
              type: "fashion_select_garment",
              slot: garmentSel.slot,
              index: garmentSel.index,
            });
            const slotLabel =
              garmentSel.slot === "bottoms"
                ? "bottom"
                : garmentSel.slot === "bags"
                  ? "bag"
                  : garmentSel.slot;
            const localReply = `Selecting ${slotLabel} number ${garmentSel.index + 1}.`;
            setReply(localReply);
            const newHistory = [
              ...historyRef.current,
              { user: t, assistant: localReply },
            ];
            historyRef.current = newHistory;
            setChatHistory(newHistory);
            setVoiceState("idle");
            return;
          }

          const effectiveMode = isCosmetics
            ? "cosmetics"
            : pageMode === "garment"
              ? "garment"
              : "overview";

          let resolvedGarmentLoc: { lat: number; lng: number } | null = null;
          if (typeof window !== "undefined" && navigator.geolocation) {
            resolvedGarmentLoc = await new Promise<{
              lat: number;
              lng: number;
            } | null>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  }),
                () => resolve(null),
                { timeout: 3000, maximumAge: 60_000 },
              );
            });
          }

          // Use pre-loaded weather when available; fetch inline on first call if not yet ready
          let weatherPayload: Record<string, unknown> | null =
            weatherRef.current as unknown as Record<string, unknown> | null;
          if (!weatherPayload && resolvedGarmentLoc) {
            try {
              const r = await fetch(
                `/api/mirror/weather?lat=${resolvedGarmentLoc.lat}&lng=${resolvedGarmentLoc.lng}`,
              );
              if (r.ok)
                weatherPayload = (await r.json()) as Record<string, unknown>;
            } catch {}
            if (!weatherPayload) {
              try {
                const r = await fetch(
                  `/api/weather?lat=${resolvedGarmentLoc.lat}&lon=${resolvedGarmentLoc.lng}`,
                );
                if (r.ok)
                  weatherPayload = (await r.json()) as Record<string, unknown>;
              } catch {}
            }
          }

          setReply("Generating answer...");
          setVoiceState("processing");

          let aiResponse;
          try {
            aiResponse = await chatWonderService.message(
              {
                input: `[stylist] ${t}`,
                sitemapContext: [...SITEMAP_CONTEXT, "back"],
                pageMode: effectiveMode,
                ...(resolvedGarmentLoc &&
                (effectiveMode === "garment" || effectiveMode === "overview")
                  ? {
                      location: {
                        lat: resolvedGarmentLoc.lat.toString(),
                        lng: resolvedGarmentLoc.lng.toString(),
                      },
                    }
                  : {}),
                ...(weatherPayload ? { weather: weatherPayload } : {}),
                ...(isCosmetics || effectiveMode === "overview"
                  ? {
                      skinAnalysis:
                        useMirrorStore.getState().skinAnalysisResult,
                    }
                  : {}),
              },
              // We speak a curated snippet below — silence the service's AudioQueue
              // so the streamed audio and the snippet don't overlap (dual voice).
              { silent: true },
            );
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Voice request failed";
            setError(message);
            setVoiceState("idle");
            setReply("");
            return;
          }

          const stylistTarget = aiResponse.stylist_data?.target_url;
          const needsNavigation = stylistTarget && stylistTarget !== pathname;

          if (needsNavigation) {
            if (aiResponse.garment_data) {
              useMirrorStore
                .getState()
                .setPendingGarmentData(aiResponse.garment_data);
            }
            if (aiResponse.cosmetics_data) {
              useMirrorStore
                .getState()
                .setChatCosmeticsData(aiResponse.cosmetics_data);
            }
            if (
              stylistTarget === ROUTES.AI_RECOMMENDATION_COSMETIC &&
              !aiResponse.cosmetics_data
            ) {
              try {
                sessionStorage.setItem(COSMETIC_PROMPT_KEY, t);
              } catch {
                /* prompt handoff is best-effort */
              }
            }
            if (stylistTarget === "back") {
              router.back();
            } else {
              router.push(stylistTarget);
            }
          } else {
            // No navigation needed (no target, or already on target page).
            // Push data reactively so the page's chatGarmentData effect consumes it.
            if (aiResponse.garment_data) {
              useMirrorStore
                .getState()
                .setChatGarmentData(aiResponse.garment_data);
            }
            if (aiResponse.cosmetics_data) {
              useMirrorStore
                .getState()
                .setChatCosmeticsData(aiResponse.cosmetics_data);
            }
          }

          const displayMessage = cleanMessage(aiResponse.message);
          setReply(displayMessage);
          const newHistory = [
            ...historyRef.current,
            { user: t, assistant: displayMessage },
          ];
          historyRef.current = newHistory;
          setChatHistory(newHistory);

          const snippet = firstNSentences(displayMessage, 3);
          const ttsAudio = await pollyTts(snippet).catch(() => null);
          if (ttsAudio) {
            setVoiceState("speaking");
            const playCtx = new AudioContext();
            playbackCtxRef.current = playCtx;
            const decoded = await playCtx.decodeAudioData(ttsAudio.slice(0));
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

          onActionRef.current?.({
            type: "GARMENT_RECOMMENDATION",
            response: aiResponse,
          });
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
              const guard = guardAction(actionToRun);
              if (guard.allowed && guard.action) {
                await executeAction(
                  guard.action,
                  router,
                  onActionRef.current ?? undefined,
                );
                r = SYSTEM_RESPONSES.defaultOpen;
              } else {
                r = guard.reply ?? SYSTEM_RESPONSES.cancelled;
              }
              audioBuffer = await pollyTts(r);
              bypassMainExecution = true;
            } else if (isNo) {
              confirmationRef.current = createIdleConfirmation();
              r = SYSTEM_RESPONSES.cancelled;
              audioBuffer = await pollyTts(r);
              bypassMainExecution = true;
            } else {
              // UNCERTAIN — pass mode flag so AI knows to ask for clarification
              (ctx as Record<string, unknown>).mode =
                "confirm_context_required";
            }
          }
        }

        if (!bypassMainExecution) {
          // COGNITIVE AI PIPELINE
          const persona = pageCtxRef.current?.persona;
          if (persona) {
            (ctx as Record<string, unknown>).persona = persona;
          }
          const language = useMirrorStore.getState().voiceLanguage;

          let locCtx:
            | { lat: number | string; lng: number | string }
            | undefined;

          let resolvedLoc: { lat: number; lng: number } | null = null;
          if (typeof window !== "undefined" && navigator.geolocation) {
            resolvedLoc = await new Promise<{
              lat: number;
              lng: number;
            } | null>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  }),
                () => resolve(null),
                { timeout: 3000, maximumAge: 60_000 },
              );
            });
          }

          if (resolvedLoc) {
            locCtx = { lat: resolvedLoc.lat, lng: resolvedLoc.lng };
            // Removed weather fetching — backend will handle it
          }
          const directNavigationRequest = isNavigationPhrase(t);
          const _isCosmetics =
            !directNavigationRequest &&
            (isCosmeticHandoffPrompt(t) ||
              pageCtxRef.current?.mode === "cosmetics" ||
              pageCtxRef.current?.route?.includes(
                "ai-recommendation-cosmetic",
              ));
          const effectivePageMode = _isCosmetics
            ? "cosmetics"
            : (pageCtxRef.current?.mode as
                | "garment"
                | "cosmetics"
                | "overview"
                | null);
          const res = await chatWonderService.message({
            input: `[stylist] ${t}`,
            lang: language,
            ...(locCtx &&
            (pageCtxRef.current?.mode === "garment" ||
              pageCtxRef.current?.mode === "overview")
              ? { location: locCtx }
              : {}),
            pageMode: effectivePageMode,
            sitemapContext: SITEMAP_CONTEXT,
            ...(_isCosmetics
              ? { skinAnalysis: useMirrorStore.getState().skinAnalysisResult }
              : {}),
          });

          r = res.message;
          events = res.events ?? [];

          let chatAction: ChatWonderAction | null = null;
          const resolvedTarget = res.stylist_data?.target_url;

          if (resolvedTarget) {
            if (res.garment_data) {
              useMirrorStore.getState().setPendingGarmentData(res.garment_data);
            }
            if (res.cosmetics_data) {
              useMirrorStore
                .getState()
                .setChatCosmeticsData(res.cosmetics_data);
            }
            if (
              resolvedTarget === ROUTES.AI_RECOMMENDATION_COSMETIC &&
              !res.cosmetics_data
            ) {
              try {
                sessionStorage.setItem(COSMETIC_PROMPT_KEY, t);
              } catch {
                /* prompt handoff is best-effort */
              }
            }
            if (resolvedTarget === ROUTES.AI_RECOMMENDATION_FASHION) {
              try {
                sessionStorage.setItem(FASHION_PROMPT_KEY, t);
              } catch {
                /* prompt handoff is best-effort */
              }
            }
            void handleStylistTarget(resolvedTarget, router, pathname);
          } else if (res.garment_data || res.maps_data || res.cosmetics_data) {
            // Synthetic action that triggers handleVoiceAction catchers
            chatAction = {
              type: "GARMENT_RECOMMENDATION",
              response: {
                garment_data: res.garment_data,
                maps_data: res.maps_data,
                cosmetics_data: res.cosmetics_data,
              },
            };
          }

          // 🧠 RUN UI KERNEL
          if (chatAction) {
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
              audioBuffer = await pollyTts(r);
            } else if (result.reply) {
              // If the kernel intercepted with a custom reply (e.g. Gender Guard)
              r = result.reply;
              audioBuffer = await pollyTts(r);
            }
          }

          // Polly generates audio for any reply not already handled by the kernel
          if (!audioBuffer && r) {
            audioBuffer = await pollyTts(r).catch(() => null);
          }
        }

        setReply(r);
        setAiEvents(events || []);
        const newHistory = [...historyRef.current, { user: t, assistant: r }];
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
          (
            err as {
              response?: { data?: { error?: string; message?: string } };
            }
          )?.response?.data?.error ||
          (
            err as {
              response?: { data?: { error?: string; message?: string } };
            }
          )?.response?.data?.message;
        setError(
          apiErrorMsg ||
            (err instanceof Error ? err.message : "Voice processing failed."),
        );
        setVoiceState("idle");
      }
    },
    [pathname, router, stopPlayback, speakText],
  );

  const submitAudio = useCallback(
    async (frames: Float32Array[]) => {
      try {
        if (frames.length === 0) {
          setVoiceState("idle");
          return;
        }

        const int16 = float32ToInt16(concatFrames(frames));
        const lang = useMirrorStore.getState().voiceLanguage || "en-US";
        const token = await resolveAccessToken();
        const transcript = await transcribeAudio({ int16, lang, token });
        if (transcript?.trim()) {
          await processTranscript(transcript.trim());
        } else {
          setVoiceState("idle");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed.");
        setVoiceState("idle");
      }
    },
    [processTranscript],
  );

  // Keep a stable ref so the mic capture path always calls the latest version
  useEffect(() => {
    submitAudioRef.current = submitAudio;
  }, [submitAudio]);

  const startListening = useCallback(async () => {
    if (voiceState !== "idle") return;
    if (micInitializingRef.current) return;
    micInitializingRef.current = true;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      });

      // Capture raw 16 kHz PCM straight from the mic. Frames are collected for
      // as long as isRecordingRef is true — i.e. until the user taps to stop.
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isRecordingRef.current) {
          speechFramesRef.current.push(
            new Float32Array(e.inputBuffer.getChannelData(0)),
          );
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      /* eslint-disable react-hooks/immutability */
      audioCtxRef.current = audioCtx;
      processorRef.current = processor;
      mediaStreamRef.current = stream;
      speechFramesRef.current = [];
      isRecordingRef.current = true;
      micInitializingRef.current = false;
      // Safety auto-stop: submit whatever was captured if the user never taps.
      maxRecordingTimerRef.current = setTimeout(() => {
        stopListeningRef.current?.();
      }, MAX_RECORDING_MS);
      /* eslint-enable react-hooks/immutability */
      setVoiceState("recording");
    } catch (err) {
      micInitializingRef.current = false;
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied."
          : err instanceof Error
            ? err.message
            : "Microphone initialisation failed.";
      setError(msg);
    }
  }, [voiceState]);

  const stopListening = useCallback(async () => {
    if (!isRecordingRef.current) return;
    // Grab the captured frames, tear down the mic, then transcribe.
    const frames = speechFramesRef.current;
    stopMicCapture();
    setVoiceState("processing");
    await submitAudioRef.current?.(frames);
  }, [stopMicCapture]);

  // Keep the ref current so the max-recording timer always calls the latest one.
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  // Tap-to-talk: the mic is not continuously armed. The user taps the mic to
  // start recording and taps again to stop; the captured audio is then
  // transcribed, processed, spoken, and the mic returns to idle.

  const submitText = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || voiceState !== "idle") return;

      setError(null);
      setReply("");
      setTranscript(t);
      setVoiceState("processing");

      try {
        if (pathname.startsWith(ROUTES.AI_ASSISTANT)) {
          await handleAIAssistantText(t);
          return;
        }

        await processTranscript(t);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Voice processing failed.",
        );
        setVoiceState("idle");
      }
    },
    [handleAIAssistantText, pathname, processTranscript, voiceState],
  );

  const toggle = useCallback(() => {
    if (voiceState === "idle") return startListening();
    if (voiceState === "recording") return stopListening();
    if (voiceState === "speaking" || voiceState === "processing") {
      stopPlayback();
      stopMicCapture();
      setTranscript("");
      setReply("");
      setError(null);
      setVoiceState("idle");
    }
  }, [voiceState, startListening, stopListening, stopPlayback, stopMicCapture]);

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
        submitText,
        speakText,
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
