"use client";

import { useRef, useState } from "react";
import { mapService } from "../services/map.service";
import { useMapStore } from "../store/useMapStore";

export type VoiceState = "idle" | "recording" | "processing" | "speaking";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return int16;
}

export const useVoiceAssistant = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<Array<{ user: string; assistant: string }>>([]);

  const isListening = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const isSpeaking = voiceState === "speaking";

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

  const startListening = async () => {
    if (voiceState !== "idle") return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);

      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(float32ToInt16(float32));
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
  };

  const stopListening = async () => {
    if (voiceState !== "recording") return;
    setVoiceState("processing");

    const chunks = chunksRef.current;
    cleanupRecording();

    const totalSamples = chunks.reduce((n, c) => n + c.length, 0);
    const combined = new Int16Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    try {
      const store   = useMapStore.getState();
      const userLoc = store.userLocation ?? store.homeLocation;
      const ctx = {
        lat:               userLoc?.lat,
        lng:               userLoc?.lng,
        traffic:           store.showTraffic,
        navigating:        store.isNavigating,
        profile:           store.activeProfile,
        remainingDistance: store.isNavigating ? store.remainingDistance : undefined,
        remainingDuration: store.isNavigating ? store.remainingDuration : undefined,
        destinationName:   store.selectedDestination?.name ?? store.selectedDestination?.address ?? undefined,
      };

      const { audio, transcript: t, reply: r, intent, destination, profile } = await mapService.voice(combined.buffer, ctx, historyRef.current);
      setTranscript(t);
      setReply(r);
      historyRef.current = [...historyRef.current, { user: t, assistant: r }].slice(-4);
      setVoiceState("speaking");

      // Start audio playback
      const playCtx = new AudioContext();
      playbackCtxRef.current = playCtx;

      const decoded = await playCtx.decodeAudioData(audio.slice(0));
      const bufSrc = playCtx.createBufferSource();
      bufSrc.buffer = decoded;
      bufSrc.connect(playCtx.destination);
      playbackRef.current = bufSrc;

      bufSrc.onended = () => {
        stopPlayback();
        setVoiceState("idle");
      };

      bufSrc.start(0);

      // Handle map intents in parallel with audio playback
      const s = useMapStore.getState();

      if (intent === "navigate" && destination) {
        const loc = s.userLocation ?? s.homeLocation ?? undefined;
        mapService.geocode(destination, loc)
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
          .catch((err) => console.error("[useVoiceAssistant] navigate failed:", err));

      } else if (intent === "traffic_route") {
        if (!s.showTraffic) s.toggleTraffic();
        if (s.activeProfile !== "car") {
          useMapStore.setState({ activeProfile: "car" });
        }
        useMapStore.getState().fetchRoute().catch((err) => console.error("[useVoiceAssistant] traffic_route fetchRoute failed:", err));

      } else if (intent === "set_profile" && profile) {
        const validProfiles = ["car", "motorcycle", "bicycle", "walking"] as const;
        if (validProfiles.includes(profile as any)) {
          s.setActiveProfile(profile as typeof validProfiles[number]);
        }

      } else if (intent === "traffic_on") {
        if (!s.showTraffic) s.toggleTraffic();

      } else if (intent === "traffic_off") {
        if (s.showTraffic) s.toggleTraffic();

      } else if (intent === "stop_navigation") {
        s.stopNavigation();
      }
    } catch (err: any) {
      setError(err.message ?? "Voice processing failed.");
      setVoiceState("idle");
    }
  };

  const toggle = () => {
    if (voiceState === "idle") return startListening();
    if (voiceState === "recording") return stopListening();
    if (voiceState === "speaking") {
      stopPlayback();
      setVoiceState("idle");
    }
  };

  return {
    voiceState,
    isListening,
    isProcessing,
    isSpeaking,
    transcript,
    reply,
    error,
    toggle,
    startListening,
    stopListening,
  };
};
