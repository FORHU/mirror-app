"use client";

import {
  createContext,
  useCallback,
  useContext,
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
import { AiEventsOverlay } from "./AiEventsOverlay";

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
        router.push(action.route);
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
      };

      const {
        audio,
        transcript: t,
        reply: r,
        action,
        events,
      } = await mapService.voice(combined.buffer, ctx, historyRef.current);

      setTranscript(t);
      setReply(r);
      setAiEvents(events || []);
      historyRef.current = [
        ...historyRef.current,
        { user: t, assistant: r },
      ].slice(-4);
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
        setVoiceState("idle");
      };
      src.start(0);

      if (action) dispatchAction(action);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Voice processing failed.");
      setVoiceState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState, dispatchAction]);

  const toggle = useCallback(() => {
    if (voiceState === "idle") return startListening();
    if (voiceState === "recording") return stopListening();
    if (voiceState === "speaking") {
      stopPlayback();
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
      }}
    >
      {children}
      <AiEventsOverlay />
    </VoiceContext.Provider>
  );
}
