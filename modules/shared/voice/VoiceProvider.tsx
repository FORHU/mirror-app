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
import { ROUTES } from "@/navigation";
import { mapService } from "@/modules/map/services/map.service";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { useOutlineStore } from "@/modules/shared/store/useOutlineStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { AiEventsOverlay } from "./AiEventsOverlay";
import { motion, AnimatePresence } from "framer-motion";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

function float32ToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let n = 0; n < f.length; n++) {
    const c = Math.max(-1, Math.min(1, f[n]));
    out[n] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

export type VoiceState = "idle" | "recording" | "processing" | "speaking";

function detectIntent(
  transcript: string,
  pathname: string = "",
): Record<string, string> {
  const t = transcript.toLowerCase().trim();

  // 0. Page-specific strict intents
  if (pathname.includes("/select-gender")) {
    if (/\b(male|homme|men|man|garçon|boy|masculin)\b/i.test(t))
      return { type: "select_gender", gender: "MALE" };
    if (/\b(female|femme|women|woman|fille|girl|féminin)\b/i.test(t))
      return { type: "select_gender", gender: "FEMALE" };
  }
  if (pathname === "/" || pathname === "/welcome") {
    if (
      /\b(start(\s+now)?|begin|let's\s+go|commencer|démarrer|c'est\s+parti|y\s+aller|go)\b/i.test(
        t,
      )
    ) {
      return { type: "navigate", route: "/select-gender" };
    }
  }

  // 1. Screen navigation
  if (
    /\b(open|show|go\s+to|ouvrir|afficher|aller\s+à|carte|navigation)\s+(the\s+|la\s+)?(map|navigation)(?!s_navigate)\b/i.test(
      t,
    )
  )
    return { type: "navigate", route: "/map" };
  if (
    /\b(build|create|make|assemble|style|do|créer|faire|assembler|choisir)\s+(an?\s+|un\s+|une\s+)?(my\s+|mon\s+|ma\s+)?(outfit|look|style|fashion|tenue|mode|vêtements?)\b|\b(pick|choose|go\s+to|open|ouvrir|aller\s+à)\s+(the\s+|la\s+|les\s+)?(my\s+|mes\s+)?(clothes|outfit|fashion|style|tenue|mode|vêtements?)(?:\s+screen|app|écran)?\b/i.test(
      t,
    )
  )
    return { type: "navigate", route: "/ai-recommendation-fashion" };
  if (
    /\b(try\s+(it\s+)?on|virtual\s+(fitting|mirror|try)|essayer|miroir\s+virtuel|essayage)\b/i.test(
      t,
    )
  )
    return { type: "navigate", route: "/virtual-mirror" };
  if (
    /\b(do|style|apply|maquiller|appliquer|faire)\s+(my\s+|mon\s+|ma\s+)?(makeup|cosmetic|skin\s*care|face|maquillage|cosmétique|soins?\s+du\s+visage|visage)\b|\b(open|go\s+to|ouvrir|aller\s+à)\s+(the\s+|le\s+|la\s+|les\s+)?(my\s+|mes\s+|mon\s+)?(makeup|cosmetic|skin\s*care|maquillage|cosmétique|soins?\s+du\s+visage)(?:\s+screen|écran)?\b/i.test(
      t,
    )
  )
    return { type: "navigate", route: "/ai-recommendation-cosmetic" };
  if (/\b(home|main\s+screen|welcome|accueil|écran\s+d'accueil)\b/i.test(t))
    return { type: "navigate", route: "/overview" };

  // 2. Travel mode
  const modeMatch = t.match(
    /(?:switch|change|set).{0,10}(?:to|mode).{0,5}(car|motorcycle|bicycle|bike|walking|walk)\b/i,
  );
  if (modeMatch) {
    const modeMap: Record<string, string> = {
      bike: "bicycle",
      walk: "walking",
    };
    const raw = modeMatch[1].toLowerCase();
    return { type: "set_profile", profile: modeMap[raw] ?? raw };
  }

  // 3. Map controls
  if (/\b(best route|avoid traffic|traffic.{0,10}route)\b/i.test(t))
    return { type: "traffic_route" };
  if (/\b(turn on|enable|show)\s+traffic\b/i.test(t))
    return { type: "traffic_on" };
  if (/\b(turn off|disable|hide)\s+traffic\b/i.test(t))
    return { type: "traffic_off" };
  if (/\b(stop|cancel|end)\s+navigation\b/i.test(t))
    return { type: "stop_navigation" };

  // 4. Navigate to a physical place
  const navMatch = t.match(
    /(?:take me to|navigate to|directions? to|drive to|go to|aller à|emmène-moi à|directions? pour)\s+(.+)/i,
  );
  if (navMatch) {
    const dest = navMatch[1].trim().toLowerCase();
    // Guard against physical routing intercepting UI commands that didn't perfectly match
    if (
      !/^(the\s+|la\s+|les\s+)?(my\s+|mon\s+|ma\s+|mes\s+)?(fashion|outfit|clothes|map|schedule|makeup|cosmetics?|skin\s*care|home|mirror|mode|tenue|vêtements?|carte|maquillage|cosmétique|accueil|miroir)(?:\s+screen|écran)?$/.test(
        dest,
      )
    ) {
      return { type: "maps_navigate", destination: dest };
    }
  }

  return { type: "speak" };
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
  const [chatHistory, setChatHistory] = useState<
    Array<{ user: string; assistant: string }>
  >([]);

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

  const dispatchAction = useCallback(
    (action: ChatWonderAction) => {
      const map = useMapStore.getState();

      if (action.type === "navigate") {
        const { setAiSuggestion, clearAiSuggestion } =
          useMirrorStore.getState();
        if (action.suggestion) {
          setAiSuggestion(action.suggestion);
        } else {
          clearAiSuggestion();
        }

        // Route guard fallback — if route somehow invalid, default to fashion screen
        const safeRoutes = [
          "/ai-recommendation-fashion",
          "/ai-recommendation-cosmetic",
          "/map",
          "/select-gender",
          "/authentication",
        ];
        const route = safeRoutes.includes(action.route)
          ? action.route
          : "/ai-recommendation-fashion";
        router.push(route);
      } else if (action.type === "speak") {
        // audio already playing — no-op
      } else if (action.type === "maps_navigate") {
        const loc = map.userLocation ?? map.homeLocation ?? undefined;
        if (pathname.startsWith("/map")) {
          mapService
            .geocode(action.destination, loc)
            .then(({ results }) => {
              if (!results.length) return;
              useMapStore.setState({
                selectedDestination: results[0],
                activeRoute: null,
                isSearching: false,
                searchResults: [],
              });
              return useMapStore.getState().fetchRoute();
            })
            .then(() => useMapStore.getState().startNavigation())
            .catch(() => {});
        } else {
          sessionStorage.setItem(
            "mirror_pending_map_directions",
            JSON.stringify({ destination: action.destination }),
          );
          router.push(ROUTES.MAP);
        }
      } else if (action.type === "traffic_on") {
        if (!map.showTraffic) map.toggleTraffic();
      } else if (action.type === "traffic_off") {
        if (map.showTraffic) map.toggleTraffic();
      } else if (action.type === "traffic_route") {
        if (!map.showTraffic) map.toggleTraffic();
        if (map.activeProfile !== "car")
          useMapStore.setState({ activeProfile: "car" });
        map.fetchRoute().catch(() => {});
      } else if (action.type === "set_profile") {
        map.setActiveProfile(action.profile);
      } else if (action.type === "stop_navigation") {
        map.stopNavigation();
      } else if (action.type === "calendar_save_event") {
        useCalendarStore.getState().addEvent({
          title: action.title,
          eventType: action.eventType,
          dateTime: action.dateTime,
          location: action.location,
        });
      } else if (action.type === "maps_preview_location") {
        sessionStorage.setItem(
          "mirror_pending_map_location",
          JSON.stringify({ query: action.query, label: action.label }),
        );
        if (!pathname.startsWith("/map")) router.push(ROUTES.MAP);
      } else if (action.type === "maps_get_directions") {
        sessionStorage.setItem(
          "mirror_pending_map_directions",
          JSON.stringify({
            destination: action.destination,
            mode: action.mode,
          }),
        );
        if (!pathname.startsWith("/map")) router.push(ROUTES.MAP);
      } else {
        // page_event, calendar_query_date, calendar_clear_event, maps_clear — forward to active page
        onActionRef.current?.(action);
      }
    },
    [router, pathname],
  );

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
        traffic: map.showTraffic,
        navigating: map.isNavigating,
        profile: map.activeProfile,
        remainingDistance: map.isNavigating ? map.remainingDistance : undefined,
        remainingDuration: map.isNavigating ? map.remainingDuration : undefined,
        destinationName:
          map.selectedDestination?.name ??
          map.selectedDestination?.address ??
          undefined,
        currentInstruction: map.isNavigating
          ? map.activeRoute?.steps?.[map.currentStepIndex]?.instruction
          : undefined,
        nextManeuverDistance: map.isNavigating
          ? map.distanceToNextManeuver
          : undefined,
        nextInstruction: map.isNavigating
          ? map.activeRoute?.steps?.[map.currentStepIndex + 1]?.instruction
          : undefined,
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
        currentPage: pageCtxRef.current?.pageName ?? pathname,
        userOutlineId: useOutlineStore.getState().outlineId ?? undefined,
        sessionId: sessionIdRef.current,
      };

      const t = await mapService.transcribe(combined.buffer);
      setTranscript(t);

      if (!t || t.trim() === "") {
        setVoiceState("idle");
        return;
      }

      const action = detectIntent(t, pathname);
      let r = "";
      let events: unknown[] = [];
      let audioBuffer: ArrayBuffer | null = null;

      if (action.type !== "speak") {
        r = "Opening that up.";
        audioBuffer = await mapService.tts(r);
        dispatchAction(action as unknown as ChatWonderAction);
      } else {
        const res = await mapService.ask(t, ctx);
        r = res.reply;
        events = res.events;
        audioBuffer = res.audio;
        if (res.sessionId) {
          sessionIdRef.current = res.sessionId;
        }
        if (res.action) dispatchAction(res.action);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState, dispatchAction]);

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
