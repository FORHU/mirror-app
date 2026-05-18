"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { mapService } from "@/modules/map/services/map.service";

export type VoiceState = "idle" | "recording" | "processing" | "speaking";

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

function float32ToInt16(f: Float32Array): Int16Array {
  const i = new Int16Array(f.length);
  for (let n = 0; n < f.length; n++) {
    const c = Math.max(-1, Math.min(1, f[n]));
    i[n] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return i;
}

function getPageLabel(pathname: string): string {
  if (pathname.startsWith("/map"))             return "map / navigation";
  if (pathname.startsWith("/kiosk-logged-in")) return "outfit capture";
  if (pathname.startsWith("/capture"))         return "gesture capture";
  if (pathname.startsWith("/waiting-login"))   return "waiting for login";
  return "home";
}

export function useGlobalVoice() {
  const pathname = usePathname();

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply,      setReply]      = useState("");
  const [error,      setError]      = useState<string | null>(null);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const sourceRef      = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const chunksRef      = useRef<Int16Array[]>([]);
  const playbackRef    = useRef<AudioBufferSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const historyRef     = useRef<Array<{ user: string; assistant: string }>>([]);

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
    sourceRef.current    = null;
    streamRef.current    = null;
    audioCtxRef.current  = null;
  };

  const startListening = async () => {
    if (voiceState !== "idle") return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx    = new AudioContext({ sampleRate: SAMPLE_RATE });
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      const source    = ctx.createMediaStreamSource(stream);

      chunksRef.current = [];
      processor.onaudioprocess = (e) => {
        chunksRef.current.push(float32ToInt16(e.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioCtxRef.current  = ctx;
      processorRef.current = processor;
      sourceRef.current    = source;
      streamRef.current    = stream;
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

    const total    = chunks.reduce((n, c) => n + c.length, 0);
    const combined = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) { combined.set(c, offset); offset += c.length; }

    try {
      // Try to read home location from map store for weather — gracefully degrade if unavailable
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { useMapStore } = await import("@/modules/map/store/useMapStore");
        const s = useMapStore.getState();
        const loc = s.userLocation ?? s.homeLocation;
        lat = loc?.lat;
        lng = loc?.lng;
      } catch { /* map store not loaded on non-map pages */ }

      const now = new Date();
      const ctx = {
        lat,
        lng,
        currentTime: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        currentDate: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        currentPage: getPageLabel(pathname),
      };

      const { audio, transcript: t, reply: r } = await mapService.voice(combined.buffer, ctx, historyRef.current);

      setTranscript(t);
      setReply(r);
      historyRef.current = [...historyRef.current, { user: t, assistant: r }].slice(-4);
      setVoiceState("speaking");

      const playCtx = new AudioContext();
      playbackCtxRef.current = playCtx;
      const decoded = await playCtx.decodeAudioData(audio.slice(0));
      const src     = playCtx.createBufferSource();
      src.buffer    = decoded;
      src.connect(playCtx.destination);
      playbackRef.current = src;
      src.onended = () => { stopPlayback(); setVoiceState("idle"); };
      src.start(0);
    } catch (err: any) {
      setError(err.message ?? "Voice processing failed.");
      setVoiceState("idle");
    }
  };

  const toggle = () => {
    if (voiceState === "idle")      return startListening();
    if (voiceState === "recording") return stopListening();
    if (voiceState === "speaking")  { stopPlayback(); setVoiceState("idle"); }
  };

  return { voiceState, transcript, reply, error, toggle };
}
