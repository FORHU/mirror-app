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
  extractLocationFromTranscript,
  mapPlaceToNearbyPOI,
  curatePOIs,
  buildPOITTS,
  matchPOIFromTranscript,
} from "@/modules/map/utils/chatWonderMapUtils";
import type { NearbyPOI } from "@/modules/map/services/map.service";
import {
  ConfirmationState,
  createIdleConfirmation,
  createPendingConfirmation,
  isExpired,
} from "./orchestration/confirmationState";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;
const CHAT_SESSION_KEY = "mirror_chat_session";
const AI_ASSISTANT_WAKE_ONLY =
  /^(?:(?:hey|hay|hi|ok|okay|hello|magic)\s+)?(?:mirror|miror|mira|miro|mere|nero|meera|mirror\s+mirror)$/i;

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
  const curatedPOIsRef = useRef<NearbyPOI[]>([]);
  const itineraryStopsRef = useRef<{ name: string; lat: number; lng: number; address?: string; placeId?: string }[]>([]);
  const isCollectingItineraryRef = useRef(false);
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
      ].slice(-4);
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

      // Route through a silent gain node so onaudioprocess keeps firing
      // without the mic audio leaking to the speakers.
      const silencer = ctx.createGain();
      silencer.gain.value = 0;
      source.connect(processor);
      processor.connect(silencer);
      silencer.connect(ctx.destination);

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
          useAuthStore.getState().user?.gender ||
          sessionStorage.getItem("mirror_gender") ||
          undefined,
      };

      const language = useMirrorStore.getState().voiceLanguage;
      const t = await mapService.transcribe(combined.buffer, language);
      setTranscript(t);

      if (!t || t.trim() === "") {
        setVoiceState("idle");
        return;
      }

      // AI Assistant page: use the shared recorder/transcriber/TTS plumbing, but
      // keep the deterministic assistant route for [nav] and overview handoff.
      if (pathname.startsWith(ROUTES.AI_ASSISTANT)) {
        await handleAIAssistantText(t);
        return;
      }

      // Garment mode: bypass the orchestration pipeline, route to chatWonderService
      if (pageCtxRef.current?.mode === "garment") {
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
        const garmentResponse = await chatWonderService.message({
          input: `[garment] ${t}`,
          voice: true,
          sitemapContext: [...SITEMAP_CONTEXT, "back"],
          ...(weather ? { weather } : {}),
        });

        if (garmentResponse.nav_data?.target_url) {
          if (garmentResponse.nav_data.target_url === "back") {
            router.back();
          } else {
            router.push(garmentResponse.nav_data.target_url);
          }
        }

        setReply(garmentResponse.message);
        const newHistory = [
          ...historyRef.current,
          { user: t, assistant: garmentResponse.message },
        ].slice(-4);
        historyRef.current = newHistory;
        setChatHistory(newHistory);

        if (garmentResponse.audioBase64) {
          setVoiceState("speaking");
          const audioBuffer = Buffer.from(
            garmentResponse.audioBase64,
            "base64",
          );
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
          response: garmentResponse,
        });
        return;
      }

      // Maps mode: use chat-wonder/message for both directions and recommendations
      if (pathname.startsWith("/map")) {
        // In itinerary mode, match voice input against nearby POIs for each stop
        const mapStateForPOI = useMapStore.getState();
        if (mapStateForPOI.itineraryStops.length > 0 && mapStateForPOI.itineraryStopPOIs.length > 0) {
          const lower = t.toLowerCase();
          let matchedPOI = null;
          let matchedStop = null;
          outer: for (const { stopIndex, pois } of mapStateForPOI.itineraryStopPOIs) {
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
            ].slice(-4);
            historyRef.current = confirmHistory;
            setChatHistory(confirmHistory);
            setVoiceState("speaking");
            if (confirmAudio) {
              const playCtx = new AudioContext();
              playbackCtxRef.current = playCtx;
              const decoded = await playCtx.decodeAudioData(confirmAudio.slice(0));
              const src = playCtx.createBufferSource();
              src.buffer = decoded;
              src.connect(playCtx.destination);
              playbackRef.current = src;
              src.onended = () => { stopPlayback(); setVoiceState("idle"); };
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
            ].slice(-4);
            historyRef.current = confirmHistory;
            setChatHistory(confirmHistory);
            setVoiceState("speaking");
            if (confirmAudio) {
              const playCtx = new AudioContext();
              playbackCtxRef.current = playCtx;
              const decoded = await playCtx.decodeAudioData(confirmAudio.slice(0));
              const src = playCtx.createBufferSource();
              src.buffer = decoded;
              src.connect(playCtx.destination);
              playbackRef.current = src;
              src.onended = () => { stopPlayback(); setVoiceState("idle"); };
              src.start(0);
            } else {
              setVoiceState("idle");
            }
            return;
          }
          // No match — abandon the POI selection, fall through to server
          curatedPOIsRef.current = [];
          useMapStore.getState().clearSuggestions();
        }

        // ── Itinerary intercept — bypass ChatWonder entirely ──────────────────
        // Finish phrase → finalise the collected itinerary
        if (isCollectingItineraryRef.current && isFinishPhrase(t)) {
          isCollectingItineraryRef.current = false;
          const stops = itineraryStopsRef.current;
          const finishReply = stops.length > 1
            ? `Here's your full route with ${stops.length} stops!`
            : "Here's your route!";
          const finishAudio = await mapService.tts(finishReply);
          setReply(finishReply);
          const fh = [...historyRef.current, { user: t, assistant: finishReply }].slice(-4);
          historyRef.current = fh;
          setChatHistory(fh);
          setVoiceState("speaking");
          if (finishAudio) {
            const playCtx = new AudioContext();
            playbackCtxRef.current = playCtx;
            const decoded = await playCtx.decodeAudioData(finishAudio.slice(0));
            const src = playCtx.createBufferSource();
            src.buffer = decoded;
            src.connect(playCtx.destination);
            playbackRef.current = src;
            src.onended = () => { stopPlayback(); setVoiceState("idle"); };
            src.start(0);
          } else { setVoiceState("idle"); }
          return;
        }

        // Itinerary or navigation phrase → geocode and add stop directly
        const mapStateForItinerary = useMapStore.getState();
        const mapLocForItinerary = mapStateForItinerary.userLocation ?? mapStateForItinerary.homeLocation;
        if (isItineraryPhrase(t) || isNavigationPhrase(t) || isCollectingItineraryRef.current) {
          const locationName = extractLocationFromTranscript(t);
          if (locationName) {
            try {
              const { results } = await mapService.geocode(locationName, mapLocForItinerary ?? undefined);
              if (results.length > 0) {
                const dest = {
                  name: results[0].name,
                  lat: results[0].lat,
                  lng: results[0].lng,
                  address: results[0].address,
                  placeId: results[0].placeId,
                };
                itineraryStopsRef.current = [...itineraryStopsRef.current, dest];
                isCollectingItineraryRef.current = true;
                if (itineraryStopsRef.current.length === 1) {
                  await useMapStore.getState().setItineraryStops([dest]);
                } else {
                  await useMapStore.getState().setItineraryStops(itineraryStopsRef.current);
                }
                const stopReply = `Got it, ${dest.name} added. Any more stops?`;
                const stopAudio = await mapService.tts(stopReply);
                setReply(stopReply);
                const sh = [...historyRef.current, { user: t, assistant: stopReply }].slice(-4);
                historyRef.current = sh;
                setChatHistory(sh);
                setVoiceState("speaking");
                if (stopAudio) {
                  const playCtx = new AudioContext();
                  playbackCtxRef.current = playCtx;
                  const decoded = await playCtx.decodeAudioData(stopAudio.slice(0));
                  const src = playCtx.createBufferSource();
                  src.buffer = decoded;
                  src.connect(playCtx.destination);
                  playbackRef.current = src;
                  src.onended = () => { stopPlayback(); setVoiceState("idle"); };
                  src.start(0);
                } else { setVoiceState("idle"); }
                return;
              }
            } catch { /* fall through to ChatWonder if geocoding fails */ }
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

        const history = historyRef.current
          .flatMap((h) => [
            { role: "user" as const, content: h.user },
            { role: "assistant" as const, content: h.assistant },
          ])
          .slice(-10);

        const enrichedInput = buildMapInput(
          t,
          mapLoc,
          mapDest,
          !!mapState.activeRoute,
          pending.length > 0 ? pending : undefined,
        );

        const res = await chatWonderService.message({
          input: enrichedInput,
          history,
        });

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
        const navigateDirect = places.length > 1 && (isNavigationPhrase(t) || isItineraryPhrase(t));
        const isItineraryInput = isItineraryPhrase(t) || isCollectingItineraryRef.current;
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
            if (!mergedForPlaces.some((s) => s.name === dest.name)) mergedForPlaces.push(dest);
            await useMapStore.getState().setItineraryStops(mergedForPlaces);
            isCollectingItineraryRef.current = true;
            const placesHasPOIs = useMapStore.getState().itineraryStopPOIs.some((s) => s.pois.length > 0);
            const placesNearbyMention = placesHasPOIs
              ? " I also found some nearby places around there you might want to visit!"
              : "";
            itineraryConfirmReply = `Got it, ${dest.name} added.${placesNearbyMention} Any more stops?`;
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
          const curated = curatePOIs(allPOIs);
          curatedPOIsRef.current = curated;
          const label = res.maps_data![0].query ?? t;
          useMapStore.getState().setSuggestedPOIs(curated, label);
        }

        // Multi-event itinerary: classify events from the response
        const { clearPendingEvents, setPendingEvents, setItineraryStops } =
          useMapStore.getState();

        clearPendingEvents();

        const resolved = responseEvents.filter(
          (e) => typeof e?.map?.lat === "number" && typeof e?.map?.lng === "number",
        );
        const incomplete = responseEvents.filter(
          (e) => !(typeof e?.map?.lat === "number" && typeof e?.map?.lng === "number"),
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
          }));
          // Merge by name — avoid duplicates when ChatWonder re-sends prior stops
          const existing = itineraryStopsRef.current;
          for (const s of newStops) {
            if (!existing.some((e) => e.name === s.name)) {
              existing.push(s);
            }
          }
          itineraryStopsRef.current = existing;
        }

        // Only route when the AI signals the itinerary is fully resolved.
        // During sequential turn collection (itinerary_setup), the AI accumulates
        // events in conversation history and asks "Any more stops?" — we do not
        // draw routes yet. Routes are drawn only on itinerary_resolved.
        const isItineraryResolved = res.intent === "itinerary_resolved";
        let etaNarration = "";
        if (isItineraryResolved && incomplete.length === 0 && resolved.length > 0 && places.length === 0) {
          // Build the candidate list from the ref (already merged with this turn's
          // resolved events above). Fall back to resolved.map only if the ref is empty.
          const accumulated = itineraryStopsRef.current.length > 0
            ? itineraryStopsRef.current
            : resolved.map((e) => ({
            name: e.map!.destination ?? "Destination",
            lat: e.map!.lat as number,
            lng: e.map!.lng as number,
            address: e.map!.address,
            placeId: e.map!.placeId,
          }));
          // Fold in any stops already drawn on the map — covers the case where a
          // prior multi-stop draw cleared the ref (e.g. the user adds a 3rd stop
          // after a 2-stop itinerary was committed).
          const existingMapStops = useMapStore.getState().itineraryStops;
          const merged = [...existingMapStops];
          for (const s of accumulated) {
            if (!merged.some((e) => e.name === s.name)) merged.push(s);
          }
          const stops = merged.length > 0 ? merged : accumulated;
          itineraryStopsRef.current = []; // always clear — existingMapStops handles accumulation
          await setItineraryStops(stops); // single or multi: always use itinerary so POIs are fetched
          isCollectingItineraryRef.current = true;
          if (stops.length === 1) {
            const resolvedHasPOIs = useMapStore.getState().itineraryStopPOIs.some((s) => s.pois.length > 0);
            const resolvedNearbyMention = resolvedHasPOIs
              ? " I also found some nearby places around there you might want to visit!"
              : "";
            itineraryConfirmReply = `Got it, ${stops[0].name} added.${resolvedNearbyMention} Any more stops?`;
          } else {
            const routes = useMapStore.getState().itineraryRoutes;
            const totalSecs = routes.reduce((s, r) => s + r.duration, 0);
            if (totalSecs > 0) {
              const mins = Math.round(totalSecs / 60);
              etaNarration = mins < 60
                ? ` Total travel time is about ${mins} minute${mins !== 1 ? "s" : ""}.`
                : ` Total travel time is about ${Math.floor(mins / 60)} hour${Math.floor(mins / 60) !== 1 ? "s" : ""} and ${mins % 60} minute${mins % 60 !== 1 ? "s" : ""}.`;
            }
          }
        }

        // Audio resolution:
        // - Multi-POI narration → client-built string, needs a TTS call
        // - Everything else → use audioBase64 returned by the API (no extra round trip)
        // In both cases, wait for the map camera to settle before playing audio
        // so the user sees the relevant pins before hearing the narration.
        const waitForMapSettle = () =>
          new Promise<void>((resolve) => {
            if (!useMapStore.getState().isPanning) { resolve(); return; }
            const unsub = useMapStore.subscribe((state) => {
              if (!state.isPanning) { unsub(); resolve(); }
            });
          });

        let mapReply: string;
        let mapAudio: ArrayBuffer | null;

        if (curatedPOIsRef.current.length > 1) {
          mapReply = buildPOITTS(curatedPOIsRef.current);
          [mapAudio] = await Promise.all([mapService.tts(mapReply), waitForMapSettle()]);
        } else {
          // itineraryConfirmReply overrides when a single stop was just confirmed —
          // the AI's message is discarded in favour of "Got it, X added. Any more stops?"
          mapReply = itineraryConfirmReply || (res.message + etaNarration);
          let rawAudio: ArrayBuffer | null = null;
          if (res.audioBase64 && !itineraryConfirmReply) {
            const binary = atob(res.audioBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
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
        ].slice(-4);
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
          src.onended = () => { stopPlayback(); setVoiceState("idle"); };
          src.start(0);
        } else {
          setVoiceState("idle");
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
  }, [voiceState, pathname, router, handleAIAssistantText, stopPlayback]);

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

        setError("Hands-free text submission is only wired on AI Assistant.");
        setVoiceState("idle");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Voice processing failed.");
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
