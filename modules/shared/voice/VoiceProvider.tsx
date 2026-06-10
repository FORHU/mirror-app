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
import { COSMETIC_PROMPT_KEY } from "@/modules/cosmetics/constants";
import { FASHION_PROMPT_KEY } from "@/modules/fashion/constants";
import { MAP_PROMPT_KEY } from "@/modules/map/constants";
import {
  buildMapInput,
  isNavigationPhrase,
  isItineraryPhrase,
  isFinishPhrase,
  isMultiEventUtterance,
  extractLocationFromTranscript,
  extractEventTypeFromTranscript,
  extractTimeBlockFromTranscript,
  extractLocationsWithMeta,
  mapPlaceToNearbyPOI,
  curatePOIs,
  buildPOITTS,
  matchPOIFromTranscript,
  isAmbiguousGeocode,
  buildDisambiguationQuestion,
  matchCandidateFromTranscript,
  buildRouteSummary,
  extractNearbyPOIQuery,
  extractActivityDestination,
  isClearRoutePhrase,
  isAddressQuery,
  isRatingQuery,
  isVenueName,
  extractOrdinalIndex,
} from "@/modules/map/utils/chatWonderMapUtils";
import type {
  NearbyPOI,
  GeocodeResult,
} from "@/modules/map/services/map.service";
import {
  ConfirmationState,
  createIdleConfirmation,
  createPendingConfirmation,
  isExpired,
} from "./orchestration/confirmationState";
import { useWeather } from "@/modules/shared/hooks/useWeather";

const CHAT_SESSION_KEY = "mirror_chat_session";
const AI_ASSISTANT_WAKE_ONLY =
  /^(?:(?:hey|hay|hi|ok|okay|hello|magic)\s+)?(?:mirror|miror|mira|miro|mere|nero|meera|mirror\s+mirror)$/i;

const ITINERARY_CONFIRM_OPENERS = [
  (name: string) => `Sounds great! I've added ${name} to your trip.`,
  (name: string) => `Perfect! ${name} is on your route.`,
  (name: string) => `Nice, ${name} is locked in!`,
  (name: string) => `Great choice — ${name} is added!`,
];
const ITINERARY_MORE_STOPS_CLOSERS = [
  "Anywhere else you'd like to go?",
  "Any other stops on your list?",
  "Where else are you headed?",
  "Want to add another place?",
];
function buildItineraryConfirmReply(
  name: string,
  hasPOIs: boolean,
  routeSummary?: string,
): string {
  const opener =
    ITINERARY_CONFIRM_OPENERS[
      Math.floor(Math.random() * ITINERARY_CONFIRM_OPENERS.length)
    ](name);
  const closer =
    ITINERARY_MORE_STOPS_CLOSERS[
      Math.floor(Math.random() * ITINERARY_MORE_STOPS_CLOSERS.length)
    ];
  const poiMention = hasPOIs
    ? " I also spotted some interesting places nearby you might enjoy!"
    : "";
  return `${opener}${routeSummary ?? ""}${poiMention} ${closer}`;
}

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

function isCosmeticHandoffPrompt(text: string): boolean {
  return /(cosmetic|makeup|make-up|skincare|skin care|foundation|moisturi|lipstick|sunscreen|serum|cleanser|toner|blush|concealer|spf|lotion|facial|eyeshadow|eye shadow|eyeliner|eye liner|lip gloss|lipgloss|lip balm|retinol|hyaluronic|niacinamide|exfoliat|acne|primer|essence|bb cream|cc cream|eye cream|face wash|face mask|face cream|sheet mask|clay mask|cream|mask|face oil|facial oil|skin oil|hair oil|body oil)\b/i.test(
    text,
  );
}

function isFashionHandoffPrompt(text: string): boolean {
  return /\b(outfit|what to wear|what should i wear|suggest.*outfit|recommend.*outfit|full look|complete look|full.*outfit|dress.*for|style.*for my|outfit.*for my|outfit.*for the|wardrobe)\b/i.test(
    text,
  );
}

function isMapDiscoveryPrompt(text: string): boolean {
  return /\b(things? to do|places? to (?:visit|go|see|explore|check out)|(?:suggest|recommend|find me?)\s+(?:a |some |me )?(?:fun|nice|good|cool|great|interesting|nearby)?\s*(?:place|spot|somewhere|destination)|where (?:can|should) i (?:go|visit|explore|hang out)|fun places?|good places?|nice places?|plan (?:my |the |a )?(?:full |)route|back-to-back schedule|route for the day|plan my (?:full |)day|fastest route|show me (?:the )?(?:fastest|quickest|shortest) route)\b/i.test(
    text,
  );
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
  // Holds the activity destination (e.g. "hiking trail") detected in the user's last
  // non-map transcript. Cleared when the user responds yes/no to the map offer.
  const pendingActivityDestRef = useRef<{
    query: string;
    label: string;
  } | null>(null);
  const historyRef = useRef<Array<{ user: string; assistant: string }>>([]);
  const curatedPOIsRef = useRef<NearbyPOI[]>([]);
  const itineraryStopsRef = useRef<
    {
      name: string;
      lat: number;
      lng: number;
      address?: string;
      placeId?: string;
      timeBlock?: string;
      eventType?: string;
    }[]
  >([]);

  useEffect(() => {
    router.prefetch(ROUTES.OVERVIEW);
    router.prefetch(ROUTES.AI_RECOMMENDATION_COSMETIC);
    router.prefetch(ROUTES.AI_RECOMMENDATION_FASHION);
    router.prefetch(ROUTES.MAP);
  }, [router]);
  const isCollectingItineraryRef = useRef(false);
  const itineraryIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const disambiguationCandidatesRef = useRef<GeocodeResult[]>([]);
  const isAwaitingDisambiguationRef = useRef(false);
  const pendingMultiStopsRef = useRef<
    {
      name: string;
      lat: number;
      lng: number;
      address?: string;
      placeId?: string;
      eventType?: string;
      timeBlock?: string;
    }[]
  >([]);
  const pendingAmbiguousQueueRef = useRef<
    {
      name: string;
      allResults: GeocodeResult[];
      eventType?: string;
      timeBlock?: string;
    }[]
  >([]);
  const disambiguationContextRef = useRef<{
    eventType?: string;
    timeBlock?: string;
  } | null>(null);
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

  const clearItineraryIdleTimer = useCallback(() => {
    if (itineraryIdleTimerRef.current) {
      clearTimeout(itineraryIdleTimerRef.current);
      itineraryIdleTimerRef.current = null;
    }
  }, []);

  const startItineraryIdleTimer = useCallback(() => {
    clearItineraryIdleTimer();
    itineraryIdleTimerRef.current = setTimeout(async () => {
      if (!isCollectingItineraryRef.current) return;
      isCollectingItineraryRef.current = false;
      itineraryStopsRef.current = [];
      const closing = "Alright, your route is all set! Enjoy your trip.";
      setReply(closing);
      const audio = await mapService.tts(closing).catch(() => null);
      if (audio) {
        setVoiceState("speaking");
        const playCtx = new AudioContext();
        playbackCtxRef.current = playCtx;
        const decoded = await playCtx.decodeAudioData(audio.slice(0));
        const src = playCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(playCtx.destination);
        playbackRef.current = src;
        src.onended = () => {
          setVoiceState("idle");
        };
        src.start(0);
      } else {
        setVoiceState("idle");
      }
    }, 15000);
  }, [clearItineraryIdleTimer]);

  // ----------------------

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
  }, []);

  // Reset pending state on route change
  useEffect(() => {
    confirmationRef.current = createIdleConfirmation();
    curatedPOIsRef.current = [];
    itineraryStopsRef.current = [];
    isCollectingItineraryRef.current = false;

    // On arrival at the Attract screen, kill any in-flight audio and start a
    // fresh chat-wonder session. Auth/gender cleared by their own owners (ADR 0001).
    if (pathname === ROUTES.WELCOME) {
      stopPlayback();
      vadRef.current?.pause();
      setVoiceState("idle");
      sessionIdRef.current = undefined;
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      historyRef.current = [];
      queueMicrotask(() => setChatHistory([]));
    }
  }, [pathname, stopPlayback]);

  const speakText = useCallback(
    async (text: string): Promise<void> => {
      const t = text?.trim();
      if (!t) return;
      stopPlayback();
      const audio = await mapService.tts(t).catch(() => null);
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
  // Also pause the VAD and reset voiceState so the mic is always usable on the
  // new page, even if navigation interrupted a processing/speaking cycle.
  useEffect(() => {
    stopPlayback();
    stopAllAudioQueues();
    vadRef.current?.pause();
    setVoiceState("idle");
  }, [pathname, stopPlayback]);

  const handleAIAssistantText = useCallback(
    async (t: string) => {
      if (AI_ASSISTANT_WAKE_ONLY.test(t.trim())) {
        setTranscript("");
        setReply("");
        setVoiceState("idle");
        return;
      }

      if (isFashionHandoffPrompt(t) && !isNavigationPhrase(t)) {
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
        router.push(ROUTES.AI_RECOMMENDATION_FASHION);
        setVoiceState("idle");
        return;
      }

      const alreadyOnMap = pageCtxRef.current?.route === ROUTES.MAP;
      if (isMapDiscoveryPrompt(t) && !isNavigationPhrase(t) && !alreadyOnMap) {
        const assistantReply = /route|schedule/i.test(t)
          ? "Opening the map to plan your route."
          : "Opening the map to find places near you.";
        setReply(assistantReply);
        const newHistory = [
          ...historyRef.current,
          { user: t, assistant: assistantReply },
        ];
        historyRef.current = newHistory;
        setChatHistory(newHistory);
        try {
          sessionStorage.setItem(MAP_PROMPT_KEY, t);
        } catch {
          /* best-effort */
        }
        router.push(ROUTES.MAP);
        setVoiceState("idle");
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
        router.push(ROUTES.AI_RECOMMENDATION_COSMETIC);
        setVoiceState("idle");
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

      if (data?.route === ROUTES.OVERVIEW) {
        try {
          sessionStorage.setItem(OVERVIEW_PROMPT_KEY, t);
        } catch {
          /* overview just won't auto-fire */
        }
      }

      if (data?.route) {
        router.push(data.route);
      }

      const finish = () => {
        setVoiceState("idle");
      };

      const audio = await mapService.tts(assistantReply).catch(() => null);
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
    [router, stopPlayback],
  );

  // VAD-based mic capture (replaces Chrome Web Speech API)
  const vadRef = useRef<{
    start: () => Promise<void>;
    pause: () => Promise<void>;
  } | null>(null);
  const vadInitializingRef = useRef(false);
  const speechFramesRef = useRef<Float32Array[]>([]);
  const isVadSpeakingRef = useRef(false);
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
        // ── Activity map offer: yes/no intercept ────────────────────────────────
        // If the AI just offered to show an activity spot on the map, handle the
        // user's response before any other processing.
        if (pendingActivityDestRef.current && !pathname.startsWith("/map")) {
          const dest = pendingActivityDestRef.current;
          pendingActivityDestRef.current = null;
          if (
            /\b(yes|yeah|sure|okay|ok|please|go|yep|yup|alright|of course|definitely|absolutely|show me|yes please)\b/i.test(
              t,
            )
          ) {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(
                "mirror_pending_map_location",
                JSON.stringify(dest),
              );
            }
            router.push(ROUTES.MAP);
            setVoiceState("idle");
            return;
          }
          // Any other response — clear the offer and continue normally.
        }

        // Detect activity intent on non-map pages. If found, the garment/general
        // response handler will chain a map offer after speaking the main reply.
        if (!pathname.startsWith("/map")) {
          const actDest = extractActivityDestination(t);
          if (actDest) pendingActivityDestRef.current = actDest;
        }
        // ── End activity map offer ──────────────────────────────────────────────

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

          let resolvedGarmentLoc = loc;
          if (
            !resolvedGarmentLoc &&
            typeof window !== "undefined" &&
            navigator.geolocation
          ) {
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
                ...(isCosmetics
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

          if (aiResponse.cosmetics_data) {
            useMirrorStore
              .getState()
              .setPendingCosmeticsData(aiResponse.cosmetics_data);
          }

          // Fall back to data-type-implied route if the server omitted target_url.
          const stylistTarget =
            aiResponse.stylist_data?.target_url ??
            (aiResponse.garment_data
              ? ROUTES.AI_RECOMMENDATION_FASHION
              : undefined) ??
            (aiResponse.cosmetics_data
              ? ROUTES.AI_RECOMMENDATION_COSMETIC
              : undefined);
          const needsNavigation = stylistTarget && stylistTarget !== pathname;

          if (needsNavigation) {
            if (aiResponse.garment_data) {
              useMirrorStore
                .getState()
                .setPendingGarmentData(aiResponse.garment_data);
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
          const actDest = pendingActivityDestRef.current;
          const offerText = actDest
            ? `Want me to also show you ${actDest.label.toLowerCase()} spots near you on the map?`
            : null;
          const fullDisplay = offerText
            ? `${displayMessage}\n\n${offerText}`
            : displayMessage;
          setReply(fullDisplay);
          const newHistory = [
            ...historyRef.current,
            { user: t, assistant: fullDisplay },
          ];
          historyRef.current = newHistory;
          setChatHistory(newHistory);

          const snippet = firstNSentences(displayMessage, 3);
          const ttsAudio = await mapService.tts(snippet).catch(() => null);
          if (ttsAudio) {
            setVoiceState("speaking");
            const playCtx = new AudioContext();
            playbackCtxRef.current = playCtx;
            const decoded = await playCtx.decodeAudioData(ttsAudio.slice(0));
            const src = playCtx.createBufferSource();
            src.buffer = decoded;
            src.connect(playCtx.destination);
            playbackRef.current = src;
            src.onended = async () => {
              if (offerText) {
                // Chain the map offer after the main fashion response.
                const offerAudio = await mapService
                  .tts(offerText)
                  .catch(() => null);
                if (offerAudio) {
                  const offerCtx = new AudioContext();
                  playbackCtxRef.current = offerCtx;
                  const offerDecoded = await offerCtx.decodeAudioData(
                    offerAudio.slice(0),
                  );
                  const offerSrc = offerCtx.createBufferSource();
                  offerSrc.buffer = offerDecoded;
                  offerSrc.connect(offerCtx.destination);
                  playbackRef.current = offerSrc;
                  offerSrc.onended = () => {
                    stopPlayback();
                    setVoiceState("idle");
                  };
                  offerSrc.start(0);
                  return;
                }
              }
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

        // Maps mode: use chat-wonder/message for both directions and recommendations
        if (pathname.startsWith("/map")) {
          // ── Fashion handoff: outfit requests on the map page navigate to fashion ─
          if (isFashionHandoffPrompt(t) && !isNavigationPhrase(t)) {
            try {
              sessionStorage.setItem(FASHION_PROMPT_KEY, t);
            } catch {
              /* best-effort */
            }
            router.push(ROUTES.AI_RECOMMENDATION_FASHION);
            const fashionReply =
              "Opening fashion recommendations for your outfit.";
            setReply(fashionReply);
            historyRef.current = [
              ...historyRef.current,
              { user: t, assistant: fashionReply },
            ];
            setChatHistory(historyRef.current);
            setVoiceState("idle");
            return;
          }

          // Cancel any pending idle timer the moment a new utterance arrives —
          // prevents "Enjoy your trip" firing while a new stop's TTS is still playing.
          clearItineraryIdleTimer();

          // Sync refs with map store — if the map was cleared externally (e.g. user
          // cleared route between tests), reset the voice refs so neither mode
          // inherits stale state from the previous session.
          {
            const ms = useMapStore.getState();
            // Never reset while awaiting a disambiguation answer — the map is still
            // empty at that point and would incorrectly clear the pending state.
            if (
              ms.itineraryStops.length === 0 &&
              ms.itineraryGroups.length === 0 &&
              !ms.selectedDestination &&
              !isAwaitingDisambiguationRef.current
            ) {
              itineraryStopsRef.current = [];
              isCollectingItineraryRef.current = false;
              disambiguationCandidatesRef.current = [];
              isAwaitingDisambiguationRef.current = false;
              pendingMultiStopsRef.current = [];
              pendingAmbiguousQueueRef.current = [];
              clearItineraryIdleTimer();
            } else if (
              ms.itineraryStops.length > 0 ||
              ms.itineraryGroups.length > 0
            ) {
              // Idle timer may have reset the ref while the store still holds stops — re-sync.
              isCollectingItineraryRef.current = true;
              if (itineraryStopsRef.current.length === 0) {
                itineraryStopsRef.current = ms.itineraryStops.map((s) => ({
                  name: s.name,
                  lat: s.lat,
                  lng: s.lng,
                  address: s.address,
                  placeId: s.placeId,
                  eventType: s.eventType,
                  timeBlock: s.timeBlock,
                }));
              }
            }
          }

          // In itinerary mode, match voice input against nearby POIs for each stop
          const mapStateForPOI = useMapStore.getState();
          if (
            mapStateForPOI.itineraryStops.length > 0 &&
            mapStateForPOI.itineraryStopPOIs.length > 0
          ) {
            const lower = t.toLowerCase();
            let matchedPOI = null;
            let matchedStop = null;
            outer: for (const {
              stopIndex,
              pois,
            } of mapStateForPOI.itineraryStopPOIs) {
              for (const poi of pois) {
                if (lower.includes(poi.name.toLowerCase())) {
                  matchedPOI = poi;
                  matchedStop = mapStateForPOI.itineraryStops[stopIndex];
                  break outer;
                }
              }
            }
            if (matchedPOI && matchedStop) {
              const dist = matchedPOI.distance ?? 0;
              mapStateForPOI.setSelectedPOI({
                name: matchedPOI.name,
                category: matchedPOI.category,
                address: matchedPOI.address,
                distance: dist * 1000,
                location: { lat: matchedPOI.lat, lng: matchedPOI.lng },
                placeId: matchedPOI.placeId,
                photo: matchedPOI.photo ?? null,
                travelFromStop: {
                  walkingMin: Math.max(1, Math.round((dist * 60) / 5)),
                  carMin: Math.max(1, Math.round((dist * 60) / 30)),
                },
              });
              const confirmReply = `Here's info on ${matchedPOI.name}.`;
              const confirmAudio = await mapService.tts(confirmReply);
              setReply(confirmReply);
              const confirmHistory = [
                ...historyRef.current,
                { user: t, assistant: confirmReply },
              ];
              historyRef.current = confirmHistory;
              setChatHistory(confirmHistory);
              setVoiceState("speaking");
              if (confirmAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  confirmAudio.slice(0),
                );
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
              return;
            }
          }

          // Client-side voice matcher — intercept if curated POIs are pending
          if (curatedPOIsRef.current.length > 0) {
            // ── Address query: reply with address instead of navigating ───────
            // Must be checked before the name match so "what's the address of
            // Foam Coffee" doesn't accidentally trigger navigation.
            if (isAddressQuery(t)) {
              const addrPOI =
                matchPOIFromTranscript(t, curatedPOIsRef.current) ??
                curatedPOIsRef.current[0];
              const addrReply = addrPOI.address
                ? `The address of ${addrPOI.name} is ${addrPOI.address}.`
                : `I don't have a specific address for ${addrPOI.name}.`;
              const addrAudio = await mapService
                .tts(addrReply)
                .catch(() => null);
              setReply(addrReply);
              historyRef.current = [
                ...historyRef.current,
                { user: t, assistant: addrReply },
              ];
              setChatHistory(historyRef.current);
              setVoiceState("speaking");
              if (addrAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  addrAudio.slice(0),
                );
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
              return;
            }

            // ── Rating query: reply with rating instead of navigating ────────
            // Must be checked before the name match so "what's the rating of
            // Foam Coffee" doesn't accidentally trigger navigation.
            if (isRatingQuery(t)) {
              const ratedPOI =
                matchPOIFromTranscript(t, curatedPOIsRef.current) ??
                curatedPOIsRef.current[0];
              const ratingReply =
                ratedPOI.rating != null
                  ? `${ratedPOI.name} is rated ${ratedPOI.rating} out of 5${ratedPOI.userRatingsTotal ? `, based on ${ratedPOI.userRatingsTotal} reviews` : ""}.`
                  : `I don't have a rating for ${ratedPOI.name}.`;
              const ratingAudio = await mapService
                .tts(ratingReply)
                .catch(() => null);
              setReply(ratingReply);
              historyRef.current = [
                ...historyRef.current,
                { user: t, assistant: ratingReply },
              ];
              setChatHistory(historyRef.current);
              setVoiceState("speaking");
              if (ratingAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  ratingAudio.slice(0),
                );
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
              return;
            }

            // ── Try to match a POI by name (works even inside navigation phrases) ─
            // "take me to Foam Coffee" → matches "Foam Coffee" from the list.
            // If the matched name is in the list, prefer the Google Places location
            // over a fresh Mapbox geocode.
            const matched = matchPOIFromTranscript(t, curatedPOIsRef.current);
            if (matched) {
              curatedPOIsRef.current = [];
              useMapStore.getState().setDestination({
                name: matched.name,
                lat: matched.lat,
                lng: matched.lng,
                address: matched.address,
                placeId: matched.placeId,
              });
              useMapStore.getState().clearSuggestions();
              const confirmReply = `Taking you to ${matched.name}.`;
              const confirmAudio = await mapService.tts(confirmReply);
              setReply(confirmReply);
              const confirmHistory = [
                ...historyRef.current,
                { user: t, assistant: confirmReply },
              ];
              historyRef.current = confirmHistory;
              setChatHistory(confirmHistory);
              setVoiceState("speaking");
              if (confirmAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  confirmAudio.slice(0),
                );
                const src = playCtx.createBufferSource();
                src.buffer = decoded;
                src.connect(playCtx.destination);
                playbackRef.current = src;
                src.onended = () => {
                  stopPlayback();
                  setVoiceState("idle");
                  setReply("");
                };
                src.start(0);
              } else {
                setVoiceState("idle");
                setReply("");
              }
              return;
            }

            // ── No name match — check if user moved on to a new intent ────────
            // "I also want to go to la trinidad" / "take me somewhere else" →
            // clear the curated list and fall through so the itinerary / nav
            // handlers below can process it.  Only escape on a clear intent
            // signal so ambiguous fragments still trigger the re-ask below.
            if (
              isItineraryPhrase(t) ||
              isNavigationPhrase(t) ||
              isClearRoutePhrase(t) ||
              isMultiEventUtterance(t)
            ) {
              curatedPOIsRef.current = [];
              useMapStore.getState().clearSuggestions();
              // fall through — do NOT return
            } else {
              // ── Re-ask with a narrowed list (max 3, by word overlap) ─────────
              const tLower = t.toLowerCase();
              const tWords = tLower.split(/\s+/).filter((w) => w.length > 2);
              const scored = curatedPOIsRef.current.map((p) => {
                const pName = p.name.toLowerCase();
                const overlap = tWords.filter(
                  (w) => pName.includes(w) || w.includes(pName.split(/\s+/)[0]),
                ).length;
                return { p, overlap };
              });
              const reAskPOIs = (
                scored.some((s) => s.overlap > 0)
                  ? scored.sort((a, b) => b.overlap - a.overlap)
                  : scored
              )
                .slice(0, 3)
                .map((s) => s.p);
              const names = reAskPOIs.map((p) => p.name);
              const reAskReply =
                names.length === 1
                  ? `Did you mean ${names[0]}?`
                  : `Did you mean ${names[0]}, or ${names[names.length - 1]}?`;
              const reAskAudio = await mapService
                .tts(reAskReply)
                .catch(() => null);
              setReply(reAskReply);
              historyRef.current = [
                ...historyRef.current,
                { user: t, assistant: reAskReply },
              ];
              setChatHistory(historyRef.current);
              setVoiceState("speaking");
              if (reAskAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  reAskAudio.slice(0),
                );
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
              return;
            }
          }

          // ── Disambiguation resolution ─────────────────────────────────────────
          if (
            isAwaitingDisambiguationRef.current &&
            disambiguationCandidatesRef.current.length > 0
          ) {
            const matched = matchCandidateFromTranscript(
              t,
              disambiguationCandidatesRef.current,
            );
            if (matched) {
              isAwaitingDisambiguationRef.current = false;
              disambiguationCandidatesRef.current = [];
              const disambigCtx = disambiguationContextRef.current;
              disambiguationContextRef.current = null;
              const dest = {
                name: matched.name,
                lat: matched.lat,
                lng: matched.lng,
                address: matched.address,
                placeId: matched.placeId,
                eventType: disambigCtx?.eventType,
                timeBlock: disambigCtx?.timeBlock,
              };

              // If more ambiguous stops are queued, ask about the next one before plotting
              const nextAmbiguous =
                pendingAmbiguousQueueRef.current.length > 0
                  ? pendingAmbiguousQueueRef.current.shift()!
                  : null;
              if (nextAmbiguous) {
                // Accumulate resolved stop into pending so it's added when the queue empties
                pendingMultiStopsRef.current = [
                  dest,
                  ...pendingMultiStopsRef.current,
                ];
                disambiguationCandidatesRef.current =
                  nextAmbiguous.allResults.slice(0, 3);
                disambiguationContextRef.current = {
                  eventType: nextAmbiguous.eventType,
                  timeBlock: nextAmbiguous.timeBlock,
                };
                isAwaitingDisambiguationRef.current = true;
                const nextClarify = buildDisambiguationQuestion(
                  nextAmbiguous.name,
                  nextAmbiguous.allResults.slice(0, 3),
                );
                const nextAudio = await mapService
                  .tts(nextClarify)
                  .catch(() => null);
                setReply(nextClarify);
                historyRef.current = [
                  ...historyRef.current,
                  { user: t, assistant: nextClarify },
                ];
                setChatHistory(historyRef.current);
                setVoiceState("speaking");
                if (nextAudio) {
                  const playCtx = new AudioContext();
                  playbackCtxRef.current = playCtx;
                  const decoded = await playCtx.decodeAudioData(
                    nextAudio.slice(0),
                  );
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
                return;
              }

              const pending = pendingMultiStopsRef.current;
              pendingMultiStopsRef.current = [];

              const allNew = [dest, ...pending];
              const existing = useMapStore.getState().itineraryStops;
              const merged = [...existing];
              for (const s of allNew) {
                if (!merged.some((e) => e.name === s.name)) merged.push(s);
              }
              itineraryStopsRef.current = merged;
              isCollectingItineraryRef.current = true;
              await useMapStore.getState().setItineraryStops(merged);

              const {
                itineraryRoutes: disambigRoutes,
                itineraryStops: disambigAllStops,
              } = useMapStore.getState();
              const disambigRouteSummary = buildRouteSummary(
                disambigRoutes,
                disambigAllStops.length,
              );
              const disambigStopPOIs = useMapStore.getState().itineraryStopPOIs;
              const hasPOIs = disambigStopPOIs.some((s) => s.pois.length > 0);
              if (hasPOIs) {
                const lastGroup = [...disambigStopPOIs]
                  .reverse()
                  .find(({ pois }) => pois.length > 0);
                if (lastGroup) {
                  const s =
                    useMapStore.getState().itineraryStops[lastGroup.stopIndex];
                  useMapStore
                    .getState()
                    .setSuggestedPOIs(
                      lastGroup.pois.slice(0, 3),
                      `Near ${s?.name ?? "stop"}`,
                    );
                }
              }
              const disambigReply =
                pending.length > 0
                  ? `Got it! Added ${allNew.length} stops: ${allNew.map((s) => s.name).join(", ")}.${disambigRouteSummary} Any more stops?`
                  : buildItineraryConfirmReply(
                      dest.name,
                      hasPOIs,
                      disambigRouteSummary,
                    );
              const disambigAudio = await mapService
                .tts(disambigReply)
                .catch(() => null);
              setReply(disambigReply);
              historyRef.current = [
                ...historyRef.current,
                { user: t, assistant: disambigReply },
              ];
              setChatHistory(historyRef.current);
              setVoiceState("speaking");
              if (disambigAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  disambigAudio.slice(0),
                );
                const src = playCtx.createBufferSource();
                src.buffer = decoded;
                src.connect(playCtx.destination);
                playbackRef.current = src;
                src.onended = () => {
                  stopPlayback();
                  setVoiceState("idle");
                  startItineraryIdleTimer();
                };
                src.start(0);
              } else {
                setVoiceState("idle");
                startItineraryIdleTimer();
              }
            } else {
              const top = disambiguationCandidatesRef.current.slice(0, 2);
              const reAsk = `Sorry, I didn't catch that. Option 1: ${top[0].address}, or option 2: ${top[1]?.address ?? "the other one"}?`;
              const reAskAudio = await mapService.tts(reAsk).catch(() => null);
              setReply(reAsk);
              setVoiceState("speaking");
              if (reAskAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  reAskAudio.slice(0),
                );
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
            }
            return;
          }

          // ── Multi-event client-side extraction ───────────────────────────────
          // When the user gives multiple stops in one sentence, extract & geocode
          // them all locally instead of relying on ChatWonder (which only returns 1).
          if (isMultiEventUtterance(t)) {
            const locationsWithMeta = extractLocationsWithMeta(t);
            if (locationsWithMeta.length >= 2) {
              const geocoded = await Promise.all(
                locationsWithMeta.map(
                  async ({ location, eventType, timeBlock }) => {
                    try {
                      // Pass user location as proximity so nearby candidates rank higher
                      // (e.g. "san fernando" resolves to La Union, not Pampanga, when the
                      // user is in the Ilocos region).
                      const { results } = await mapService.geocode(
                        location,
                        loc ?? undefined,
                      );
                      if (!results.length) return null;
                      return {
                        name: location,
                        result: results[0],
                        allResults: results,
                        eventType,
                        timeBlock,
                      };
                    } catch {
                      return null;
                    }
                  },
                ),
              );
              const valid = geocoded.filter(
                (g): g is NonNullable<typeof g> => g !== null,
              );
              if (valid.length >= 2) {
                // Check first ambiguous result — ask for clarification before plotting
                const ambiguous = valid.find((g) =>
                  isAmbiguousGeocode(g.allResults),
                );
                if (ambiguous) {
                  // Queue ALL other ambiguous stops for sequential one-at-a-time resolution
                  pendingAmbiguousQueueRef.current = valid
                    .filter(
                      (g) =>
                        g !== ambiguous && isAmbiguousGeocode(g.allResults),
                    )
                    .map((g) => ({
                      name: g.name,
                      allResults: g.allResults,
                      eventType: g.eventType ?? undefined,
                      timeBlock: g.timeBlock ?? undefined,
                    }));
                  // Non-ambiguous stops are ready to add once all disambiguations are resolved
                  pendingMultiStopsRef.current = valid
                    .filter(
                      (g) =>
                        g !== ambiguous && !isAmbiguousGeocode(g.allResults),
                    )
                    .map((g) => ({
                      name: g.result.name,
                      lat: g.result.lat,
                      lng: g.result.lng,
                      address: g.result.address,
                      placeId: g.result.placeId,
                      eventType: g.eventType ?? undefined,
                      timeBlock: g.timeBlock ?? undefined,
                    }));
                  disambiguationCandidatesRef.current =
                    ambiguous.allResults.slice(0, 3);
                  disambiguationContextRef.current = {
                    eventType: ambiguous.eventType ?? undefined,
                    timeBlock: ambiguous.timeBlock ?? undefined,
                  };
                  isAwaitingDisambiguationRef.current = true;
                  const clarifyReply = buildDisambiguationQuestion(
                    ambiguous.name,
                    ambiguous.allResults.slice(0, 3),
                  );
                  const clarifyAudio = await mapService
                    .tts(clarifyReply)
                    .catch(() => null);
                  setReply(clarifyReply);
                  historyRef.current = [
                    ...historyRef.current,
                    { user: t, assistant: clarifyReply },
                  ];
                  setChatHistory(historyRef.current);
                  setVoiceState("speaking");
                  if (clarifyAudio) {
                    const playCtx = new AudioContext();
                    playbackCtxRef.current = playCtx;
                    const decoded = await playCtx.decodeAudioData(
                      clarifyAudio.slice(0),
                    );
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
                  return;
                }
                const stops = valid.map((g) => ({
                  name: g.result.name,
                  lat: g.result.lat,
                  lng: g.result.lng,
                  address: g.result.address,
                  placeId: g.result.placeId,
                  eventType: g.eventType ?? undefined,
                  timeBlock: g.timeBlock ?? undefined,
                }));
                const existing = useMapStore.getState().itineraryStops;
                const merged = [...existing];
                for (const s of stops) {
                  if (!merged.some((e) => e.name === s.name)) merged.push(s);
                }
                await useMapStore.getState().setItineraryStops(merged);
                itineraryStopsRef.current = merged;
                isCollectingItineraryRef.current = true;
                const routes = useMapStore.getState().itineraryRoutes;
                const etaNarration = buildRouteSummary(routes, merged.length);
                const stopPOIs = useMapStore.getState().itineraryStopPOIs;
                const poiMentions = merged
                  .map((stop, i) => {
                    const entry = stopPOIs.find((s) => s.stopIndex === i);
                    const top = entry?.pois.slice(0, 2) ?? [];
                    return top.length
                      ? `near ${stop.name}: ${top.map((p) => p.name).join(" and ")}`
                      : null;
                  })
                  .filter(Boolean);
                const poiLine =
                  poiMentions.length > 0
                    ? ` Some spots you might enjoy — ${poiMentions.join("; ")}.`
                    : "";
                const names = merged.map((s) => s.name).join(", ");
                const multiReply = `Got it! Added ${merged.length} stops: ${names}.${poiLine}${etaNarration} Any more stops?`;
                const multiAudio = await mapService
                  .tts(multiReply)
                  .catch(() => null);
                setReply(multiReply);
                historyRef.current = [
                  ...historyRef.current,
                  { user: t, assistant: multiReply },
                ];
                setChatHistory(historyRef.current);
                setVoiceState("speaking");
                if (multiAudio) {
                  const playCtx = new AudioContext();
                  playbackCtxRef.current = playCtx;
                  const decoded = await playCtx.decodeAudioData(
                    multiAudio.slice(0),
                  );
                  const src = playCtx.createBufferSource();
                  src.buffer = decoded;
                  src.connect(playCtx.destination);
                  playbackRef.current = src;
                  src.onended = () => {
                    stopPlayback();
                    setVoiceState("idle");
                    startItineraryIdleTimer();
                  };
                  src.start(0);
                } else {
                  setVoiceState("idle");
                  startItineraryIdleTimer();
                }
                return;
              }
            }
            // Fewer than 2 locations extracted — fall through to ChatWonder
          }

          // ── Itinerary intercept — bypass ChatWonder entirely ──────────────────
          // Clear route phrase → wipe the itinerary and start fresh
          if (isClearRoutePhrase(t)) {
            itineraryStopsRef.current = [];
            isCollectingItineraryRef.current = false;
            disambiguationCandidatesRef.current = [];
            isAwaitingDisambiguationRef.current = false;
            pendingMultiStopsRef.current = [];
            pendingAmbiguousQueueRef.current = [];
            await useMapStore.getState().clearItinerary();
            const clearReply = "Route cleared. What's your first stop?";
            const clearAudio = await mapService
              .tts(clearReply)
              .catch(() => null);
            setReply(clearReply);
            historyRef.current = [
              ...historyRef.current,
              { user: t, assistant: clearReply },
            ];
            setChatHistory(historyRef.current);
            setVoiceState("speaking");
            if (clearAudio) {
              const playCtx = new AudioContext();
              playbackCtxRef.current = playCtx;
              const decoded = await playCtx.decodeAudioData(
                clearAudio.slice(0),
              );
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
            return;
          }

          // Finish phrase → finalise the collected itinerary
          if (isCollectingItineraryRef.current && isFinishPhrase(t)) {
            isCollectingItineraryRef.current = false;
            const stops = itineraryStopsRef.current;
            const finishReply =
              stops.length > 1
                ? `Here's your full route with ${stops.length} stops!`
                : "Here's your route!";
            const finishAudio = await mapService.tts(finishReply);
            setReply(finishReply);
            const fh = [
              ...historyRef.current,
              { user: t, assistant: finishReply },
            ];
            historyRef.current = fh;
            setChatHistory(fh);
            setVoiceState("speaking");
            if (finishAudio) {
              const playCtx = new AudioContext();
              playbackCtxRef.current = playCtx;
              const decoded = await playCtx.decodeAudioData(
                finishAudio.slice(0),
              );
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
            return;
          }

          // Itinerary or navigation phrase → geocode and add stop directly
          // Note: if isMultiEventUtterance fired but extractLocationsWithMeta found < 2
          // locations (e.g. "going to vigan city to avalanche" — activity verb after "to"
          // falsely triggers the multi-event check), we still want to land here so the
          // single-event path handles it. The multi-event path already returns early when
          // it succeeds, so there is no double-processing risk.
          if (
            isItineraryPhrase(t) ||
            isNavigationPhrase(t) ||
            isCollectingItineraryRef.current
          ) {
            // Cancel any pending idle-timeout immediately — geocoding is async and
            // the timer could otherwise fire mid-flight, falsely ending the session.
            clearItineraryIdleTimer();

            // ── Show-POIs intercept ─────────────────────────────────────────────
            // "show me the recommended places from SM City Baguio" while collecting
            // stops → read out the POIs for that stop, then re-ask for more stops.
            // Must run BEFORE extractLocationFromTranscript so the phrase isn't
            // mistakenly geocoded as a new destination.
            if (isCollectingItineraryRef.current) {
              const isShowPOIsRequest =
                (/\brecommend(?:ed|ations?)?\b/i.test(t) &&
                  /\bplaces?\b/i.test(t)) ||
                /\bshow\s+(?:me\s+)?(?:the\s+)?places?\s+(?:near|from|around|for)\b/i.test(
                  t,
                ) ||
                /\bwhat(?:'s|\s+are)\s+(?:the\s+)?(?:places?|spots?|recommendations?)\b/i.test(
                  t,
                );

              if (isShowPOIsRequest) {
                const { itineraryStops, itineraryStopPOIs } =
                  useMapStore.getState();
                const lower = t.toLowerCase();
                const transcriptWords = lower
                  .split(/\s+/)
                  .filter((w) => w.length > 3);

                // Match stop by checking if any meaningful transcript word appears in the stop name
                let matchedGroup = itineraryStopPOIs.find(
                  ({ stopIndex, pois }) => {
                    if (pois.length === 0) return false;
                    const stop = itineraryStops[stopIndex];
                    return (
                      stop != null &&
                      transcriptWords.some((w) =>
                        stop.name.toLowerCase().includes(w),
                      )
                    );
                  },
                );
                // Fallback: most recently added stop that has POIs
                if (!matchedGroup) {
                  matchedGroup = [...itineraryStopPOIs]
                    .reverse()
                    .find(({ pois }) => pois.length > 0);
                }

                if (matchedGroup && matchedGroup.pois.length > 0) {
                  const stop = itineraryStops[matchedGroup.stopIndex];
                  const pois = matchedGroup.pois.slice(0, 3);
                  useMapStore
                    .getState()
                    .setSuggestedPOIs(pois, `Near ${stop?.name ?? "stop"}`);
                  const poiLines = pois
                    .map(
                      (p, i) =>
                        `${["First", "Second", "Third"][i]}, ${p.name}${p.rating != null ? ` rated ${p.rating.toFixed(1)}` : ""}`,
                    )
                    .join("; ");
                  const closer =
                    ITINERARY_MORE_STOPS_CLOSERS[
                      Math.floor(
                        Math.random() * ITINERARY_MORE_STOPS_CLOSERS.length,
                      )
                    ];
                  const poiReply = `Here are the recommended places near ${stop?.name ?? "that stop"}: ${poiLines}. ${closer}`;
                  const poiAudio = await mapService
                    .tts(poiReply)
                    .catch(() => null);
                  setReply(poiReply);
                  historyRef.current = [
                    ...historyRef.current,
                    { user: t, assistant: poiReply },
                  ];
                  setChatHistory(historyRef.current);
                  setVoiceState("speaking");
                  if (poiAudio) {
                    const playCtx = new AudioContext();
                    playbackCtxRef.current = playCtx;
                    const decoded = await playCtx.decodeAudioData(
                      poiAudio.slice(0),
                    );
                    const src = playCtx.createBufferSource();
                    src.buffer = decoded;
                    src.connect(playCtx.destination);
                    playbackRef.current = src;
                    src.onended = () => {
                      stopPlayback();
                      setVoiceState("idle");
                      startItineraryIdleTimer();
                    };
                    src.start(0);
                  } else {
                    setVoiceState("idle");
                    startItineraryIdleTimer();
                  }
                  return;
                }
              }
            }
            // ── End show-POIs intercept ─────────────────────────────────────────

            const locationName =
              extractLocationFromTranscript(t) ??
              // Fallback: when collecting stops, strip filler words and treat the
              // remainder as the location query (handles bare replies like "san
              // fernando la union" or "yeah also baguio for lunch").
              (isCollectingItineraryRef.current
                ? t
                    .replace(
                      /\b(yeah|yes|okay|ok|sure|also|and then|how about|add|for lunch|for dinner|for breakfast|this morning|this afternoon|this evening|tonight|this lunch|this dinner|at \d+(?::\d+)?\s*(?:am|pm)?|around \d+|please|can you|that|the)\b/gi,
                      " ",
                    )
                    .replace(/\s{2,}/g, " ")
                    .trim() || null
                : null);
            if (locationName) {
              try {
                // Pass proximity so nearby POI/street queries (e.g. "session road jollibee"
                // in Baguio) rank the local result first. Region/place results are
                // protected by the placeType preference below — if proximity surfaces a
                // nearby address but there's a region in the top 3, we prefer the region.
                const itinUserLoc =
                  useMapStore.getState().userLocation ??
                  useMapStore.getState().homeLocation;
                const { results } = await mapService.geocode(
                  locationName,
                  itinUserLoc ?? undefined,
                );
                if (results.length > 0 && isAmbiguousGeocode(results)) {
                  disambiguationCandidatesRef.current = results.slice(0, 3);
                  disambiguationContextRef.current = {
                    eventType: extractEventTypeFromTranscript(t) ?? undefined,
                    timeBlock: extractTimeBlockFromTranscript(t) ?? undefined,
                  };
                  isAwaitingDisambiguationRef.current = true;
                  // Use the geocoded place name — not the raw query — so the question
                  // reads "I found two places called 'La Union'" rather than echoing
                  // the full user transcript when the fallback query was used.
                  const displayName =
                    locationName.split(/\s+/).length > 4
                      ? results[0].name
                      : locationName;
                  const clarifyReply = buildDisambiguationQuestion(
                    displayName,
                    results.slice(0, 3),
                  );
                  const clarifyAudio = await mapService
                    .tts(clarifyReply)
                    .catch(() => null);
                  setReply(clarifyReply);
                  historyRef.current = [
                    ...historyRef.current,
                    { user: t, assistant: clarifyReply },
                  ];
                  setChatHistory(historyRef.current);
                  setVoiceState("speaking");
                  if (clarifyAudio) {
                    const playCtx = new AudioContext();
                    playbackCtxRef.current = playCtx;
                    const decoded = await playCtx.decodeAudioData(
                      clarifyAudio.slice(0),
                    );
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
                  return;
                }
                if (results.length > 0) {
                  // When proximity biases a nearby street/address to the top, pick
                  // the most semantically correct result from the top 3:
                  // • Venue-type query ("saint louis university", "good taste mall") →
                  //   prefer a poi result (the specific place) over a bare address
                  // • Region/province query ("la union", "benguet") →
                  //   prefer a region/place result over a local street with the same name
                  const isVenueQuery = isVenueName(locationName);
                  const top = results[0];
                  const preferred =
                    top.placeType === "address" ||
                    top.placeType === "neighborhood"
                      ? isVenueQuery
                        ? (results
                            .slice(0, 3)
                            .find((r) => r.placeType === "poi") ??
                          results
                            .slice(0, 3)
                            .find(
                              (r) =>
                                r.placeType === "region" ||
                                r.placeType === "place",
                            ) ??
                          top)
                        : (results
                            .slice(0, 3)
                            .find(
                              (r) =>
                                r.placeType === "region" ||
                                r.placeType === "place",
                            ) ?? top)
                      : top;
                  const dest = {
                    name: preferred.name,
                    lat: preferred.lat,
                    lng: preferred.lng,
                    address: preferred.address,
                    placeId: preferred.placeId,
                    eventType: extractEventTypeFromTranscript(t) ?? undefined,
                    timeBlock: extractTimeBlockFromTranscript(t) ?? undefined,
                  };
                  const startingNewLeg =
                    !isCollectingItineraryRef.current &&
                    useMapStore.getState().itineraryGroups.length > 0;
                  if (startingNewLeg) {
                    itineraryStopsRef.current = [dest];
                    isCollectingItineraryRef.current = true;
                    await useMapStore.getState().addItineraryGroup([dest]);
                  } else {
                    itineraryStopsRef.current = [
                      ...itineraryStopsRef.current,
                      dest,
                    ];
                    isCollectingItineraryRef.current = true;
                    const existingStops = useMapStore.getState().itineraryStops;
                    const merged = [...existingStops];
                    if (!merged.some((s) => s.name === dest.name))
                      merged.push(dest);
                    await useMapStore.getState().setItineraryStops(merged);
                  }
                  const {
                    itineraryRoutes: stopRoutes,
                    itineraryStops: allStops,
                  } = useMapStore.getState();
                  const routeSummary = buildRouteSummary(
                    stopRoutes,
                    allStops.length,
                  );
                  const stopPOIData = useMapStore.getState().itineraryStopPOIs;
                  const hasPOIs = stopPOIData.some((s) => s.pois.length > 0);
                  if (hasPOIs) {
                    const lastGroup = [...stopPOIData]
                      .reverse()
                      .find(({ pois }) => pois.length > 0);
                    if (lastGroup) {
                      const s =
                        useMapStore.getState().itineraryStops[
                          lastGroup.stopIndex
                        ];
                      useMapStore
                        .getState()
                        .setSuggestedPOIs(
                          lastGroup.pois.slice(0, 3),
                          `Near ${s?.name ?? "stop"}`,
                        );
                    }
                  }
                  const stopReply = buildItineraryConfirmReply(
                    dest.name,
                    hasPOIs,
                    routeSummary,
                  );
                  const stopAudio = await mapService
                    .tts(stopReply)
                    .catch(() => null);
                  setReply(stopReply);
                  historyRef.current = [
                    ...historyRef.current,
                    { user: t, assistant: stopReply },
                  ];
                  setChatHistory(historyRef.current);
                  setVoiceState("speaking");
                  if (stopAudio) {
                    const playCtx = new AudioContext();
                    playbackCtxRef.current = playCtx;
                    const decoded = await playCtx.decodeAudioData(
                      stopAudio.slice(0),
                    );
                    const src = playCtx.createBufferSource();
                    src.buffer = decoded;
                    src.connect(playCtx.destination);
                    playbackRef.current = src;
                    src.onended = () => {
                      stopPlayback();
                      setVoiceState("idle");
                      startItineraryIdleTimer();
                    };
                    src.start(0);
                  } else {
                    setVoiceState("idle");
                    startItineraryIdleTimer();
                  }
                  return;
                }
              } catch {
                /* fall through to ChatWonder if geocoding fails */
              }
            }
          }
          // ── End itinerary intercept ────────────────────────────────────────────

          const mapState = useMapStore.getState();
          // Prefer live GPS over IP-based homeLocation — IP geolocation can be
          // hundreds of km off for fixed kiosk devices where the ISP's registered
          // address differs from the actual device location.
          let mapLoc = mapState.userLocation;
          if (
            !mapLoc &&
            typeof window !== "undefined" &&
            "geolocation" in navigator
          ) {
            mapLoc = await new Promise<{ lat: number; lng: number } | null>(
              (resolve) => {
                navigator.geolocation.getCurrentPosition(
                  ({ coords }) => {
                    const loc = { lat: coords.latitude, lng: coords.longitude };
                    useMapStore.getState().setUserLocation(loc);
                    resolve(loc);
                  },
                  () => resolve(null),
                  { timeout: 3000, maximumAge: 10000 },
                );
              },
            );
          }
          if (!mapLoc) mapLoc = mapState.homeLocation;
          const mapDest = mapState.selectedDestination;
          const pending = mapState.pendingEvents;

          // ── Itinerary group ordinal selection ────────────────────────────────
          // "i want to go to the third option" when itinerary groups are active →
          // resolve the ordinal to the Nth stop of the active group instead of
          // sending the phrase to ChatWonder where it gets misinterpreted.
          if (mapState.itineraryGroups.length > 0) {
            const ordinalIdx = extractOrdinalIndex(t);
            if (ordinalIdx !== null) {
              const activeGroup =
                mapState.itineraryGroups[mapState.activeItineraryIndex];
              const stop = activeGroup?.stops[ordinalIdx];
              if (stop) {
                useMapStore.getState().setDestination({
                  name: stop.name,
                  lat: stop.lat,
                  lng: stop.lng,
                  address: stop.address,
                  placeId: stop.placeId,
                });
                const ordinalReply = `Taking you to ${stop.name}.`;
                const ordinalAudio = await mapService
                  .tts(ordinalReply)
                  .catch(() => null);
                setReply(ordinalReply);
                historyRef.current = [
                  ...historyRef.current,
                  { user: t, assistant: ordinalReply },
                ];
                setChatHistory(historyRef.current);
                setVoiceState("speaking");
                if (ordinalAudio) {
                  const playCtx = new AudioContext();
                  playbackCtxRef.current = playCtx;
                  const decoded = await playCtx.decodeAudioData(
                    ordinalAudio.slice(0),
                  );
                  const src = playCtx.createBufferSource();
                  src.buffer = decoded;
                  src.connect(playCtx.destination);
                  playbackRef.current = src;
                  src.onended = () => {
                    stopPlayback();
                    setVoiceState("idle");
                    setReply("");
                  };
                  src.start(0);
                } else {
                  setVoiceState("idle");
                  setReply("");
                }
                return;
              }
            }
          }
          // ── End itinerary group ordinal selection ─────────────────────────────

          // ── Nearby POI intercept ──────────────────────────────────────────────
          // Checked BEFORE session init — most voice queries ("recommend me a cafe")
          // are handled locally and never need ChatWonder.
          //
          // Two paths:
          //   • "nearest/closest X" → route-to-nearest (5 km radius, setDestination)
          //   • "find X near me"    → browse list (1.5 km radius, curated POI cards)
          const nearbyQuery = extractNearbyPOIQuery(t);
          const isNearestRouteQuery =
            nearbyQuery !== null && /\b(?:nearest|closest)\b/i.test(t);
          if (nearbyQuery && mapLoc) {
            try {
              const { pois } = await mapService.nearbyPOIs(
                mapLoc.lat,
                mapLoc.lng,
                isNearestRouteQuery ? 5000 : 1500,
                nearbyQuery,
              );
              if (pois.length > 0) {
                if (isNearestRouteQuery) {
                  // Route directly to the nearest result.
                  const nearest = pois[0];
                  useMapStore.getState().setDestination({
                    name: nearest.name,
                    lat: nearest.lat,
                    lng: nearest.lng,
                    address: nearest.address,
                    placeId: nearest.placeId,
                  });
                  const routeReply = `Taking you to ${nearest.name}${nearest.address ? `, at ${nearest.address}` : ""}.`;
                  const routeAudio = await mapService
                    .tts(routeReply)
                    .catch(() => null);
                  setReply(routeReply);
                  historyRef.current = [
                    ...historyRef.current,
                    { user: t, assistant: routeReply },
                  ];
                  setChatHistory(historyRef.current);
                  setVoiceState("speaking");
                  if (routeAudio) {
                    const playCtx = new AudioContext();
                    playbackCtxRef.current = playCtx;
                    const decoded = await playCtx.decodeAudioData(
                      routeAudio.slice(0),
                    );
                    const src = playCtx.createBufferSource();
                    src.buffer = decoded;
                    src.connect(playCtx.destination);
                    playbackRef.current = src;
                    src.onended = () => {
                      stopPlayback();
                      setVoiceState("idle");
                      setReply("");
                    };
                    src.start(0);
                  } else {
                    setVoiceState("idle");
                    setReply("");
                  }
                  return;
                }
                // Browse intent — list the curated POI cards as before.
                const curated = curatePOIs(pois);
                curatedPOIsRef.current = curated;
                useMapStore.getState().setSuggestedPOIs(curated, nearbyQuery);
                const poiTTS = buildPOITTS(curated);
                const poiAudio = await mapService.tts(poiTTS).catch(() => null);
                setReply(poiTTS);
                historyRef.current = [
                  ...historyRef.current,
                  { user: t, assistant: poiTTS },
                ];
                setChatHistory(historyRef.current);
                setVoiceState("speaking");
                if (poiAudio) {
                  const playCtx = new AudioContext();
                  playbackCtxRef.current = playCtx;
                  const decoded = await playCtx.decodeAudioData(
                    poiAudio.slice(0),
                  );
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
                return;
              }
              // No results found at this location — give a clear error instead of
              // silently falling through to ChatWonder (which always fails for POI queries).
              const noResultReply = `I couldn't find a nearby ${nearbyQuery} in this area. You can try asking for a different type of place.`;
              const noResultAudio = await mapService
                .tts(noResultReply)
                .catch(() => null);
              setReply(noResultReply);
              historyRef.current = [
                ...historyRef.current,
                { user: t, assistant: noResultReply },
              ];
              setChatHistory(historyRef.current);
              setVoiceState("speaking");
              if (noResultAudio) {
                const playCtx = new AudioContext();
                playbackCtxRef.current = playCtx;
                const decoded = await playCtx.decodeAudioData(
                  noResultAudio.slice(0),
                );
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
              return;
            } catch {
              /* fall through to ChatWonder */
            }
          }
          // ── End nearby POI intercept ──────────────────────────────────────────

          const voiceLang = useMirrorStore.getState().voiceLanguage || "en-US";
          const enrichedInput = buildMapInput(
            t,
            mapLoc,
            mapDest,
            !!mapState.activeRoute,
            pending.length > 0 ? pending : undefined,
            "[map]",
            voiceLang,
          );

          const res = await chatWonderService.message(
            {
              input: enrichedInput,
              lang: voiceLang,
            },
            // Map page speaks its own short curated reply below — silence the
            // service AudioQueue so they don't overlap (dual voice).
            { silent: true },
          );

          if (res.stylist_data?.target_url) {
            const targetUrl = res.stylist_data.target_url;
            if (targetUrl === "back") {
              router.back();
            } else if (targetUrl !== ROUTES.OVERVIEW) {
              // Never let ChatWonder redirect away to /overview from the map page —
              // route/schedule queries should always be resolved on the map.
              router.push(targetUrl);
            }
          }

          const originLat = mapLoc?.lat ?? 0;
          const originLng = mapLoc?.lng ?? 0;

          // If events are returned, skip maps_data entirely — events take priority.
          const responseEvents = Array.isArray(res.events) ? res.events : [];
          const hasEvents = responseEvents.length > 0;

          // Overrides res.message when a single itinerary stop is confirmed — set in
          // both the places path (MAP intent + itinerary phrase) and the
          // itinerary_resolved path so the user is always asked "Any more stops?".
          let itineraryConfirmReply = "";

          // places_data: single place → navigate, multiple → curate and suggest.
          // For direct navigation phrases ("take me to X"), always navigate to the
          // first (best) result without showing the curation stack.
          const places = hasEvents ? [] : (res.maps_data?.[0]?.places ?? []);
          const navigateDirect =
            places.length > 1 &&
            (isNavigationPhrase(t) || isItineraryPhrase(t));
          const isItineraryInput =
            isItineraryPhrase(t) || isCollectingItineraryRef.current;
          if (places.length === 1 || navigateDirect) {
            if (isItineraryInput) {
              // Itinerary-phrased single destination: use setItineraryStops so that
              // (a) nearby POI dots are fetched, (b) the stop is in itineraryStops for
              // future turn accumulation, and (c) we can ask "Any more stops?".
              const dest = {
                name: places[0].name,
                lat: places[0].lat,
                lng: places[0].lng,
                address: places[0].address,
                placeId: places[0].place_id,
              };
              const existingForPlaces = useMapStore.getState().itineraryStops;
              const mergedForPlaces = [...existingForPlaces];
              if (!mergedForPlaces.some((s) => s.name === dest.name))
                mergedForPlaces.push(dest);
              await useMapStore.getState().setItineraryStops(mergedForPlaces);
              isCollectingItineraryRef.current = true;
              const {
                itineraryRoutes: placesRoutes,
                itineraryStops: placesAllStops,
              } = useMapStore.getState();
              const placesRouteSummary = buildRouteSummary(
                placesRoutes,
                placesAllStops.length,
              );
              const placesStopPOIs = useMapStore.getState().itineraryStopPOIs;
              const placesHasPOIs = placesStopPOIs.some(
                (s) => s.pois.length > 0,
              );
              if (placesHasPOIs) {
                const lastGroup = [...placesStopPOIs]
                  .reverse()
                  .find(({ pois }) => pois.length > 0);
                if (lastGroup) {
                  const s =
                    useMapStore.getState().itineraryStops[lastGroup.stopIndex];
                  useMapStore
                    .getState()
                    .setSuggestedPOIs(
                      lastGroup.pois.slice(0, 3),
                      `Near ${s?.name ?? "stop"}`,
                    );
                }
              }
              itineraryConfirmReply = buildItineraryConfirmReply(
                dest.name,
                placesHasPOIs,
                placesRouteSummary,
              );
            } else {
              useMapStore.getState().setDestination({
                name: places[0].name,
                lat: places[0].lat,
                lng: places[0].lng,
                address: places[0].address,
                placeId: places[0].place_id,
              });
            }
          } else if (places.length > 1) {
            const allPOIs: NearbyPOI[] = places.map((p) =>
              mapPlaceToNearbyPOI(p, originLat, originLng),
            );
            const label = res.maps_data![0].query ?? t;
            // Only apply the 30 km proximity cap when we have a real user location.
            // When mapLoc is null, originLat/originLng are 0,0 — every PH place is
            // ~1 400 km away, so filtering would silently discard everything and fall
            // back to the unfiltered list, defeating the purpose entirely.
            const MAX_POI_KM = 30;
            const hasRealLocation = mapLoc != null;
            let poolToUse = allPOIs;
            if (hasRealLocation) {
              const nearbyPOIs = allPOIs.filter(
                (p) => (p.distance ?? Infinity) <= MAX_POI_KM,
              );
              // If no results within 30 km (user asked about a far-away place), show all.
              poolToUse = nearbyPOIs.length > 0 ? nearbyPOIs : allPOIs;
            }
            const curated = curatePOIs(poolToUse);
            curatedPOIsRef.current = curated;
            useMapStore.getState().setSuggestedPOIs(curated, label);

            // Enrich with real venue photos in background (ChatWonder doesn't return photo_url)
            const needsPhoto = curated.filter((p) => !p.photo && p.placeId);
            if (needsPhoto.length > 0) {
              Promise.all(
                needsPhoto.map((poi) =>
                  mapService
                    .venuePhotos(poi.placeId!)
                    .then(({ photos }) => ({
                      placeId: poi.placeId!,
                      photo: photos[0] ?? null,
                    }))
                    .catch(() => ({ placeId: poi.placeId!, photo: null })),
                ),
              ).then((results) => {
                const photoMap = new Map(
                  results.map((r) => [r.placeId, r.photo]),
                );
                const enriched = curated.map((p) => ({
                  ...p,
                  photo: photoMap.get(p.placeId!) ?? p.photo,
                }));
                curatedPOIsRef.current = enriched;
                useMapStore.getState().setSuggestedPOIs(enriched, label);
              });
            }
          }

          // Multi-event itinerary: classify events from the response
          const { clearPendingEvents, setPendingEvents, setItineraryStops } =
            useMapStore.getState();

          clearPendingEvents();

          const resolved = responseEvents.filter(
            (e) =>
              typeof e?.map?.lat === "number" &&
              typeof e?.map?.lng === "number",
          );
          const incomplete = responseEvents.filter(
            (e) =>
              !(
                typeof e?.map?.lat === "number" &&
                typeof e?.map?.lng === "number"
              ),
          );

          if (incomplete.length > 0) {
            setPendingEvents(
              incomplete.map((e) => ({
                eventName: e.eventName ?? "event",
                eventType: e.eventType ?? "general",
                timeLabel: e.timeLabel ?? "",
                missingFields: [
                  ...(!e.timeLabel ? (["time"] as const) : []),
                  "location" as const,
                ],
              })),
            );
          }

          // Accumulate resolved stops across itinerary_setup turns so that when
          // itinerary_resolved fires (possibly with only the last new stop from
          // ChatWonder), we still have the full picture.
          if (resolved.length > 0) {
            const newStops = resolved.map((e) => ({
              name: e.map!.destination ?? "Destination",
              lat: e.map!.lat as number,
              lng: e.map!.lng as number,
              address: e.map!.address,
              placeId: e.map!.placeId,
              timeBlock: e.timeLabel ?? undefined,
              eventType: e.eventType ?? undefined,
            }));
            const existing = itineraryStopsRef.current;
            for (const s of newStops) {
              if (!existing.some((e) => e.name === s.name)) existing.push(s);
            }
            itineraryStopsRef.current = existing;
          }

          // Draw route when: (a) itinerary_resolved OR (b) 2+ stops resolved in one
          // turn — user gave all stops at once, no need to wait.
          const isItineraryResolved = res.intent === "itinerary_resolved";
          const shouldDrawNow =
            (isItineraryResolved || resolved.length >= 2) &&
            incomplete.length === 0 &&
            itineraryStopsRef.current.length > 0 &&
            places.length === 0;
          let etaNarration = "";
          if (shouldDrawNow) {
            const accumulated = itineraryStopsRef.current;
            const existingMapStops = useMapStore.getState().itineraryStops;
            const merged = [...existingMapStops];
            for (const s of accumulated) {
              if (!merged.some((e) => e.name === s.name)) merged.push(s);
            }
            const stops = merged.length > 0 ? merged : accumulated;
            itineraryStopsRef.current = [];
            await setItineraryStops(stops);
            isCollectingItineraryRef.current = true;
            if (stops.length === 1) {
              const {
                itineraryRoutes: resolvedRoutes,
                itineraryStops: resolvedStops,
              } = useMapStore.getState();
              const resolvedRouteSummary = buildRouteSummary(
                resolvedRoutes,
                resolvedStops.length,
              );
              const resolvedStopPOIs = useMapStore.getState().itineraryStopPOIs;
              const resolvedHasPOIs = resolvedStopPOIs.some(
                (s) => s.pois.length > 0,
              );
              if (resolvedHasPOIs) {
                const lastGroup = [...resolvedStopPOIs]
                  .reverse()
                  .find(({ pois }) => pois.length > 0);
                if (lastGroup) {
                  const s =
                    useMapStore.getState().itineraryStops[lastGroup.stopIndex];
                  useMapStore
                    .getState()
                    .setSuggestedPOIs(
                      lastGroup.pois.slice(0, 3),
                      `Near ${s?.name ?? "stop"}`,
                    );
                }
              }
              itineraryConfirmReply = buildItineraryConfirmReply(
                stops[0].name,
                resolvedHasPOIs,
                resolvedRouteSummary,
              );
              // Timer starts after audio finishes (see mapAudio onended below)
            } else {
              const routes = useMapStore.getState().itineraryRoutes;
              etaNarration = buildRouteSummary(routes, stops.length);
              const names = stops.map((s) => s.name).join(", ");
              const stopPOIs = useMapStore.getState().itineraryStopPOIs;
              const poiMentions = stops
                .map((stop, i) => {
                  const entry = stopPOIs.find((s) => s.stopIndex === i);
                  const top = entry?.pois.slice(0, 2) ?? [];
                  return top.length
                    ? `near ${stop.name}: ${top.map((p) => p.name).join(" and ")}`
                    : null;
                })
                .filter(Boolean);
              const poiLine =
                poiMentions.length > 0
                  ? ` Some spots you might enjoy — ${poiMentions.join("; ")}.`
                  : "";
              itineraryConfirmReply = `Got it! Added ${stops.length} stops: ${names}.${poiLine}${etaNarration} Any more stops?`;
            }
          }

          // Audio resolution:
          // - Multi-POI narration → client-built string, needs a TTS call
          // - Everything else → use audioBase64 returned by the API (no extra round trip)
          // In both cases, wait for the map camera to settle before playing audio
          // so the user sees the relevant pins before hearing the narration.
          const waitForMapSettle = () =>
            new Promise<void>((resolve) => {
              if (!useMapStore.getState().isPanning) {
                resolve();
                return;
              }
              const unsub = useMapStore.subscribe((state) => {
                if (!state.isPanning) {
                  unsub();
                  resolve();
                }
              });
            });

          let mapReply: string;
          let mapAudio: ArrayBuffer | null;

          if (curatedPOIsRef.current.length > 1) {
            mapReply = buildPOITTS(curatedPOIsRef.current);
            [mapAudio] = await Promise.all([
              mapService.tts(mapReply),
              waitForMapSettle(),
            ]);
          } else {
            // itineraryConfirmReply overrides when a single stop was just confirmed —
            // the AI's message is discarded in favour of "Got it, X added. Any more stops?"
            // On the map page always keep replies short — never speak a ChatWonder essay.
            // Take only the first sentence of res.message as fallback.
            const firstSentence =
              (res.message ?? "").match(/^[^.!?]+[.!?]/)?.[0] ??
              (res.message ?? "").slice(0, 120);
            mapReply = itineraryConfirmReply || firstSentence + etaNarration;
            let rawAudio: ArrayBuffer | null = null;
            if (res.audioBase64 && !itineraryConfirmReply) {
              const binary = atob(res.audioBase64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++)
                bytes[i] = binary.charCodeAt(i);
              rawAudio = bytes.buffer;
            }
            [mapAudio] = await Promise.all([
              rawAudio ? Promise.resolve(rawAudio) : mapService.tts(mapReply),
              waitForMapSettle(),
            ]);
          }

          setReply(mapReply);
          const mapHistory = [
            ...historyRef.current,
            { user: enrichedInput, assistant: mapReply },
          ];
          historyRef.current = mapHistory;
          setChatHistory(mapHistory);
          setVoiceState("speaking");

          if (mapAudio) {
            const playCtx = new AudioContext();
            playbackCtxRef.current = playCtx;
            const decoded = await playCtx.decodeAudioData(mapAudio.slice(0));
            const src = playCtx.createBufferSource();
            src.buffer = decoded;
            src.connect(playCtx.destination);
            playbackRef.current = src;
            src.onended = () => {
              stopPlayback();
              setVoiceState("idle");
              if (itineraryConfirmReply) startItineraryIdleTimer();
            };
            src.start(0);
          } else {
            setVoiceState("idle");
            if (itineraryConfirmReply) startItineraryIdleTimer();
          }
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
            if (loc) {
              (ctx as Record<string, unknown>).location = {
                lat: String(loc.lat),
                lng: String(loc.lng),
              };
            }
            const dest = map.selectedDestination;
            if (dest) {
              (ctx as Record<string, unknown>).destinationLocation = {
                lat: String(dest.lat),
                lng: String(dest.lng),
              };
            }
          }
          const language = useMirrorStore.getState().voiceLanguage;

          let locCtx:
            | { lat: number | string; lng: number | string }
            | undefined;

          // Fallback to homeLocation explicitly when map store has no location
          // (e.g. on the AI assistant page where the map module never initialises).
          let resolvedLoc = loc;
          if (
            !resolvedLoc &&
            useMapStore.getState().homeLocationStatus === "idle"
          ) {
            await useMapStore.getState().loadHomeLocation();
            const freshMap = useMapStore.getState();
            resolvedLoc = freshMap.userLocation ?? freshMap.homeLocation;
          }

          if (
            !resolvedLoc &&
            typeof window !== "undefined" &&
            navigator.geolocation
          ) {
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
            : directNavigationRequest
              ? "map"
              : (pageCtxRef.current?.mode as
                  | "garment"
                  | "cosmetics"
                  | "map"
                  | "overview"
                  | null);
          const res = await chatWonderService.message({
            input: `[stylist] ${t}`,
            lang: language,
            voice: true,
            ...(locCtx &&
            (directNavigationRequest ||
              pageCtxRef.current?.mode === "garment" ||
              pageCtxRef.current?.mode === "overview" ||
              pageCtxRef.current?.mode === "map")
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
          if (res.audioBase64) {
            const buf = Buffer.from(res.audioBase64, "base64");
            audioBuffer = buf.buffer.slice(
              buf.byteOffset,
              buf.byteOffset + buf.byteLength,
            ) as ArrayBuffer;
          }

          let chatAction: ChatWonderAction | null = null;
          const resolvedTarget = res.stylist_data?.target_url;

          if (resolvedTarget) {
            if (res.garment_data) {
              useMirrorStore.getState().setPendingGarmentData(res.garment_data);
            }
            if (res.cosmetics_data) {
              useMirrorStore
                .getState()
                .setPendingCosmeticsData(res.cosmetics_data);
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
    [
      pathname,
      router,
      stopPlayback,
      startItineraryIdleTimer,
      clearItineraryIdleTimer,
    ],
  );

  const submitAudio = useCallback(
    async (frames: Float32Array[]) => {
      if (frames.length === 0) {
        setVoiceState("idle");
        return;
      }

      const int16 = float32ToInt16(concatFrames(frames));

      try {
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

  // Keep a stable ref so VAD callbacks (created once) always call the latest version
  useEffect(() => {
    submitAudioRef.current = submitAudio;
  }, [submitAudio]);

  const startListening = useCallback(async () => {
    if (voiceState !== "idle") return;
    setError(null);

    // Reuse existing VAD instance — just re-start it
    if (vadRef.current) {
      vadRef.current.start();
      return;
    }

    // Prevent concurrent initialisation
    if (vadInitializingRef.current) return;
    vadInitializingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true },
      });

      // Capture raw 16 kHz PCM using ScriptProcessorNode while VAD is active
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isVadSpeakingRef.current) {
          speechFramesRef.current.push(
            new Float32Array(e.inputBuffer.getChannelData(0)),
          );
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      audioCtxRef.current = audioCtx;
      processorRef.current = processor;
      mediaStreamRef.current = stream;

      const { MicVAD } = await import("@ricky0123/vad-web");
      const vad = await MicVAD.new({
        getStream: () => Promise.resolve(stream),
        baseAssetPath: "/",
        onnxWASMBasePath: "/",
        model: "v5",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ortConfig(ort: any) {
          ort.env.wasm.wasmPaths = "/";
        },
        onSpeechStart: () => {
          isVadSpeakingRef.current = true;
          speechFramesRef.current = [];
          setVoiceState("recording");
        },
        onSpeechEnd: async () => {
          // Guard: stopListening force-submit already cleared this
          if (!isVadSpeakingRef.current) return;
          isVadSpeakingRef.current = false;
          const frames = speechFramesRef.current;
          speechFramesRef.current = [];
          setVoiceState("processing");
          await submitAudioRef.current?.(frames);
        },
        onVADMisfire: () => {
          isVadSpeakingRef.current = false;
          speechFramesRef.current = [];
          setVoiceState("idle");
        },
      });

      vadRef.current = vad;
      vadInitializingRef.current = false;
      vad.start();
    } catch (err) {
      vadInitializingRef.current = false;
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
    if (voiceState !== "recording") return;

    if (isVadSpeakingRef.current && speechFramesRef.current.length > 0) {
      // Force-submit: claim the frames before VAD's onSpeechEnd can fire
      isVadSpeakingRef.current = false;
      const frames = speechFramesRef.current;
      speechFramesRef.current = [];
      vadRef.current?.pause();
      setVoiceState("processing");
      await submitAudioRef.current?.(frames);
    } else {
      vadRef.current?.pause();
      setVoiceState("idle");
    }
  }, [voiceState]);

  // Touch-to-talk: the mic is no longer continuously armed. The user taps the
  // mic control to start listening; the pipeline then auto-stops on silence
  // (see startListening's VAD), processes, speaks, and returns to idle — where
  // it stays until the next tap. Every page shares this same handling.

  const submitText = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || voiceState !== "idle") return;

      setError(null);
      setReply("");
      setTranscript(t);
      setVoiceState("processing");

      try {
        if (pathname.startsWith(ROUTES.WELCOME)) {
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
      vadRef.current?.pause();
      setTranscript("");
      setReply("");
      setError(null);
      setVoiceState("idle");
    }
  }, [voiceState, startListening, stopListening, stopPlayback]);

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
