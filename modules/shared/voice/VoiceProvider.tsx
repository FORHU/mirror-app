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
  isClearRoutePhrase,
  isVenueName,
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

  const isPresent = useMirrorStore((s) => s.isPresent);
  const sensorStatus = useMirrorStore((s) => s.sensorStatus);

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
  const mapSessionInitRef = useRef(false);
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
    curatedPOIsRef.current = [];
    itineraryStopsRef.current = [];
    isCollectingItineraryRef.current = false;
    if (!pathname.startsWith("/map")) mapSessionInitRef.current = false;

    // Begin a fresh chat-wonder Voice session on arrival at the Attract screen.
    // Auth, kiosk pairing, and gender are cleared by their own owners (see ADR 0001).
    if (pathname === ROUTES.WELCOME) {
      sessionIdRef.current = undefined;
      sessionStorage.removeItem(CHAT_SESSION_KEY);
      historyRef.current = [];
      queueMicrotask(() => setChatHistory([]));
    }
  }, [pathname]);

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
    }, 10000);
  }, [clearItineraryIdleTimer]);

  // ----------------------

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;
  }, []);

  const handleAIAssistantText = useCallback(
    async (t: string) => {
      if (AI_ASSISTANT_WAKE_ONLY.test(t.trim())) {
        setTranscript("");
        setReply("");
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

      const finish = () => {
        if (data?.route) router.push(data.route);
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

  interface ISpeechRecognition {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    continuous: boolean;
    onstart: () => void;
    onend: () => void;
    onerror: (event: { error: string }) => void;
    onresult: (event: {
      resultIndex: number;
      results: Array<{
        isFinal: boolean;
        [index: number]: { transcript: string };
      }>;
    }) => void;
    stop: () => void;
    start: () => void;
  }

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const processTranscript = useCallback(
    async (t: string) => {
      setTranscript(t);

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
        if (
          pageMode === "garment" ||
          pageMode === "cosmetics" ||
          pageCtxRef.current?.route?.includes("ai-recommendation-cosmetic")
        ) {
          let weather: Record<string, unknown> | undefined;
          if (loc) {
            try {
              const res = await fetch(
                `/api/mirror/weather?lat=${loc.lat}&lng=${loc.lng}`,
              );
              if (res.ok) {
                const json = await res.json();
                const d = json.data ?? json;
                weather = {
                  date: new Date().toISOString().split("T")[0],
                  description: String(d.condition ?? "").toLowerCase(),
                  estimated: false,
                  is_cold: Number(d.temperature) < 20,
                  is_hot: Number(d.temperature) >= 30,
                  is_rainy:
                    Number(d.precipitationProb) >= 50 ||
                    String(d.condition ?? "")
                      .toLowerCase()
                      .includes("rain"),
                  lat: loc.lat,
                  lon: loc.lng,
                  temperature_c: Number(d.temperature),
                };
              }
            } catch {
              /* weather is best-effort */
            }
          }

          const isCosmetics =
            pageMode === "cosmetics" ||
            pageCtxRef.current?.route?.includes("ai-recommendation-cosmetic");

          const aiResponse = await chatWonderService.message({
            input: `[stylist] ${t}`,
            voice: true,
            sitemapContext: [...SITEMAP_CONTEXT, "back"],
            ...(weather ? { weather } : {}),
            ...(loc ? { location: { lat: loc.lat.toString(), lng: loc.lng.toString() } } : {}),
            ...(isCosmetics ? { skinAnalysis: useMirrorStore.getState().skinAnalysisResult } : {}),
          });

          if (aiResponse.stylist_data?.target_url) {
            if (aiResponse.garment_data) {
              useMirrorStore
                .getState()
                .setPendingGarmentData(aiResponse.garment_data);
            }
            if (aiResponse.cosmetics_data) {
              useMirrorStore
                .getState()
                .setPendingCosmeticsData(aiResponse.cosmetics_data);
            }
            if (aiResponse.stylist_data.target_url === "back") {
              router.back();
            } else {
              router.push(aiResponse.stylist_data.target_url);
            }
          } else {
            // No navigation — already on the target page. Push data reactively so
            // the fashion/cosmetics page's chatGarmentData effect can consume it.
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

          setReply(aiResponse.message);
          const newHistory = [
            ...historyRef.current,
            { user: t, assistant: aiResponse.message },
          ];
          historyRef.current = newHistory;
          setChatHistory(newHistory);

          if (aiResponse.audioBase64) {
            setVoiceState("speaking");
            const audioBuffer = Buffer.from(aiResponse.audioBase64, "base64");
            const playCtx = new AudioContext();
            playbackCtxRef.current = playCtx;
            const decoded = await playCtx.decodeAudioData(
              audioBuffer.buffer.slice(
                audioBuffer.byteOffset,
                audioBuffer.byteOffset + audioBuffer.byteLength,
              ),
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

          onActionRef.current?.({
            type: "GARMENT_RECOMMENDATION",
            response: aiResponse,
          });
          return;
        }

        // Maps mode: use chat-wonder/message for both directions and recommendations
        if (pathname.startsWith("/map")) {
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
                };
                src.start(0);
              } else {
                setVoiceState("idle");
              }
              return;
            }
            // No match — re-ask with a narrowed list instead of silently dropping state.
            // Filter candidates by word overlap with what the user said, then cap at 3
            // so the re-ask doesn't repeat all 5 names again.
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
            const reAskAudio = await mapService.tts(reAskReply).catch(() => null);
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
              const decoded = await playCtx.decodeAudioData(reAskAudio.slice(0));
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
              const hasPOIs = useMapStore
                .getState()
                .itineraryStopPOIs.some((s) => s.pois.length > 0);
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
                    };
                    src.start(0);
                  } else {
                    setVoiceState("idle");
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
                  const hasPOIs = useMapStore
                    .getState()
                    .itineraryStopPOIs.some((s) => s.pois.length > 0);
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

          if (!mapSessionInitRef.current) {
            await chatWonderService.getSessionId();
            mapSessionInitRef.current = true;
          }

          const mapState = useMapStore.getState();
          const mapLoc = mapState.userLocation ?? mapState.homeLocation;
          const mapDest = mapState.selectedDestination;
          const pending = mapState.pendingEvents;

          // ── Nearby POI intercept ──────────────────────────────────────────────
          // "nearest starbucks", "find me X near me" — bypass ChatWonder (which
          // can't use the location context) and call nearbyPOIs directly.
          const nearbyQuery = extractNearbyPOIQuery(t);
          if (nearbyQuery && mapLoc) {
            try {
              const { pois } = await mapService.nearbyPOIs(
                mapLoc.lat,
                mapLoc.lng,
                1500,
                nearbyQuery,
              );
              if (pois.length > 0) {
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
            } catch {
              /* fall through to ChatWonder */
            }
          }
          // ── End nearby POI intercept ──────────────────────────────────────────

          const enrichedInput = buildMapInput(
            t,
            mapLoc,
            mapDest,
            !!mapState.activeRoute,
            pending.length > 0 ? pending : undefined,
            "[maps]",
          );

          const res = await chatWonderService.message({
            input: enrichedInput,
          });

          if (res.stylist_data?.target_url) {
            if (res.stylist_data.target_url === "back") {
              router.back();
            } else {
              router.push(res.stylist_data.target_url);
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
              const placesHasPOIs = useMapStore
                .getState()
                .itineraryStopPOIs.some((s) => s.pois.length > 0);
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
              const resolvedHasPOIs = useMapStore
                .getState()
                .itineraryStopPOIs.some((s) => s.pois.length > 0);
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
          let weatherCtx: Record<string, unknown> | undefined;

          // Fallback to browser geolocation when map store has no location
          // (e.g. on the AI assistant page where the map module never initialises).
          let resolvedLoc = loc;
          if (!resolvedLoc && typeof window !== "undefined" && navigator.geolocation) {
            resolvedLoc = await new Promise<{ lat: number; lng: number } | null>(
              (resolve) => {
                navigator.geolocation.getCurrentPosition(
                  (pos) =>
                    resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => resolve(null),
                  { timeout: 3000, maximumAge: 60_000 },
                );
              },
            );
          }

          if (resolvedLoc) {
            locCtx = { lat: resolvedLoc.lat, lng: resolvedLoc.lng };
            try {
              const wRes = await fetch(
                `/api/mirror/weather?lat=${resolvedLoc.lat}&lng=${resolvedLoc.lng}`,
              );
              if (wRes.ok) {
                const json = await wRes.json();
                const d = json.data ?? json;
                weatherCtx = {
                  date: new Date().toISOString().split("T")[0],
                  description: String(d.condition ?? "").toLowerCase(),
                  estimated: false,
                  is_cold: Number(d.temperature) < 20,
                  is_hot: Number(d.temperature) >= 30,
                  is_rainy:
                    Number(d.precipitationProb) >= 50 ||
                    String(d.condition ?? "")
                      .toLowerCase()
                      .includes("rain"),
                  lat: resolvedLoc.lat,
                  lon: resolvedLoc.lng,
                  temperature_c: Number(d.temperature),
                };
              }
            } catch {
              /* best effort */
            }
          }

          const res = await chatWonderService.message({
            input: `[stylist] ${t}`,
            lang: language,
            voice: true,
            location: locCtx,
            sitemapContext: SITEMAP_CONTEXT,
            ...(weatherCtx ? { weather: weatherCtx } : {}),
            skinAnalysis: useMirrorStore.getState().skinAnalysisResult,
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
          if (res.stylist_data?.target_url) {
            if (res.garment_data) {
              useMirrorStore.getState().setPendingGarmentData(res.garment_data);
            }
            if (res.cosmetics_data) {
              useMirrorStore
                .getState()
                .setPendingCosmeticsData(res.cosmetics_data);
            }
            void handleStylistTarget(
              res.stylist_data.target_url,
              router,
              pathname,
            );
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

  const startListening = useCallback(async () => {
    if (voiceState !== "idle") return;
    setError(null);
    try {
      type SpeechRecognitionConstructor = new () => ISpeechRecognition;
      const SpeechRecognition =
        (
          window as unknown as {
            SpeechRecognition: SpeechRecognitionConstructor;
          }
        ).SpeechRecognition ||
        (
          window as unknown as {
            webkitSpeechRecognition: SpeechRecognitionConstructor;
          }
        ).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError("Speech recognition is not supported in this browser.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = useMirrorStore.getState().voiceLanguage || "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;

      let accumulated = "";
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      const SILENCE_MS = 1000;

      const clearSilenceTimer = () => {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      };

      recognition.onstart = () => setVoiceState("recording");
      recognition.onerror = (event: { error: string }) => {
        clearSilenceTimer();
        if (event.error !== "no-speech")
          setError("Speech recognition error: " + event.error);
        if (event.error !== "no-speech") setVoiceState("idle");
      };
      recognition.onresult = (event: {
        resultIndex: number;
        results: Array<{
          isFinal: boolean;
          [index: number]: { transcript: string };
        }>;
      }) => {
        // Reset silence timer on every new final segment — only stop + process
        // after SILENCE_MS of no new speech, so Chrome sentence-boundary onend
        // events mid-utterance don't cut the user off prematurely.
        clearSilenceTimer();
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            accumulated +=
              (accumulated ? " " : "") + event.results[i][0].transcript;
          }
        }
        if (accumulated.trim()) {
          silenceTimer = setTimeout(() => {
            silenceTimer = null;
            recognition.stop();
          }, SILENCE_MS);
        }
      };
      recognition.onend = async () => {
        clearSilenceTimer();
        const text = accumulated.trim();
        if (text) {
          setVoiceState("processing");
          await processTranscript(text);
        } else {
          setVoiceState("idle");
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setError("Microphone access denied.");
    }
  }, [voiceState, processTranscript]);

  const stopListening = useCallback(async () => {
    if (voiceState !== "recording") return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [voiceState]);

  // Full-voice: keep the mic continuously armed on every page while someone is
  // at the mirror. Whenever the pipeline returns to idle, re-arm after a short
  // beat so the mirror is always listening hands-free — spoken commands route
  // through processTranscript → [stylist]. Gated on camera presence so an empty
  // room isn't transcribed; falls through when the sensor is "unavailable"
  // (dev / no camera) so it stays testable. startListening() no-ops unless idle.
  useEffect(() => {
    if (voiceState !== "idle") return;
    if (!isPresent && sensorStatus !== "unavailable") return;
    const id = setTimeout(() => {
      void startListening();
    }, 500);
    return () => clearTimeout(id);
  }, [voiceState, startListening, isPresent, sensorStatus]);

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

        setError("Hands-free text submission is only wired on AI Assistant.");
        setVoiceState("idle");
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Voice processing failed.",
        );
        setVoiceState("idle");
      }
    },
    [handleAIAssistantText, pathname, voiceState],
  );

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

  // Continuous listening globally: after each turn returns to idle,
  // re-arm the mic so the mirror keeps catching voice hands-free on all pages.
  // Safe because the wake-word gate ignores anything that isn't a "Mirror ..."
  // command. Waits for "idle" so it never captures its own TTS while speaking.
  useEffect(() => {
    if (!isPresent && sensorStatus !== "unavailable") return;
    if (voiceState !== "idle") return;

    const id = setTimeout(() => startListening(), 600);
    return () => clearTimeout(id);
  }, [voiceState, isPresent, sensorStatus, startListening]);

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
