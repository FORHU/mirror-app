"use client";

import { useEffect, useRef, useState } from "react";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";

const VOICE_SAMPLE_RATE = 16000;
const VOICE_BUFFER_SIZE = 4096;

function pcmFloat32ToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let n = 0; n < f.length; n++) {
    const c = Math.max(-1, Math.min(1, f[n]));
    out[n] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

type RecordStep =
  | "idle"
  | "recording"
  | "transcribing"
  | "loading"
  | "done"
  | "error";

export function VoiceTranscribeOverlay({
  onAiComplete,
  onLoadingChange,
}: {
  onAiComplete?: (response: ChatWonderMessageResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const [step, setStep] = useState<RecordStep>("idle");
  const [transcript, setTranscript] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const weatherRef = useRef<Record<string, unknown> | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        try {
          const res = await fetch(`/api/mirror/weather?lat=${lat}&lng=${lon}`);
          if (!res.ok) return;
          const json = await res.json();
          const d = json.data ?? json;
          locationRef.current = { lat, lng: lon };
          weatherRef.current = {
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
            temperature_c: Number(d.temperature),
          };
        } catch {
          // weather is best-effort
        }
      },
      () => {
        /* geolocation denied */
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  function cleanupMic() {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }

  async function startRecording() {
    setErrorMsg("");
    setTranscript("");
    setAiReply("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const ctx = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
      const processor = ctx.createScriptProcessor(VOICE_BUFFER_SIZE, 1, 1);
      const source = ctx.createMediaStreamSource(stream);
      chunksRef.current = [];
      processor.onaudioprocess = (e) => {
        chunksRef.current.push(
          pcmFloat32ToInt16(e.inputBuffer.getChannelData(0)),
        );
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      audioCtxRef.current = ctx;
      processorRef.current = processor;
      sourceRef.current = source;
      streamRef.current = stream;
      setStep("recording");
    } catch {
      setErrorMsg("Microphone access denied");
      setStep("error");
    }
  }

  async function stopAndTranscribe() {
    setStep("transcribing");
    onLoadingChange?.(true);
    const chunks = chunksRef.current;
    cleanupMic();

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const combined = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.length;
    }

    let rawText = "";
    try {
      const res = await fetch("/api/mirror/voice/transcribe?lang=en-US", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: combined.buffer,
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const body = await res.json().catch(() => null);
      rawText = (body?.transcript ?? body?.text ?? "").trim();
      if (!rawText) {
        onLoadingChange?.(false);
        setErrorMsg("No speech detected");
        setStep("error");
        return;
      }
    } catch (err: unknown) {
      onLoadingChange?.(false);
      setErrorMsg((err as Error).message ?? "Transcription failed");
      setStep("error");
      return;
    }

    setTranscript(rawText);
    setStep("loading");

    abortCtrlRef.current = new AbortController();
    try {
      const response = await chatWonderService.message(
        {
          input: `[garment] ${rawText}`,
          ...(weatherRef.current ? { weather: weatherRef.current } : {}),
          ...(locationRef.current ? { location: locationRef.current } : {}),
        },
        abortCtrlRef.current.signal,
      );
      onLoadingChange?.(false);
      setAiReply(response.message);
      setStep("done");
      onAiComplete?.(response);
    } catch (err: unknown) {
      onLoadingChange?.(false);
      setErrorMsg((err as Error).message ?? "Request failed");
      setStep("error");
    }
  }

  function handleToggle() {
    if (step === "idle") return startRecording();
    if (step === "recording") return stopAndTranscribe();
    if (step === "done" || step === "error") {
      abortCtrlRef.current?.abort();
      setTranscript("");
      setAiReply("");
      setErrorMsg("");
      setStep("idle");
    }
  }

  const isRecording = step === "recording";
  const isBusy = step === "transcribing" || step === "loading";

  return (
    <>
      {(transcript || aiReply || errorMsg) && (
        <div
          style={{
            position: "fixed",
            bottom: "100px",
            right: "20px",
            zIndex: 9999,
            width: "320px",
            maxHeight: "60vh",
            overflowY: "auto",
            background: "rgba(10,10,18,0.88)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "16px",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {errorMsg ? (
            <p
              style={{
                color: "rgba(239,68,68,0.9)",
                fontSize: "13px",
                margin: 0,
              }}
            >
              {errorMsg}
            </p>
          ) : (
            <>
              {transcript && (
                <div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      margin: "0 0 3px 0",
                    }}
                  >
                    You
                  </p>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontSize: "12px",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {transcript}
                  </p>
                </div>
              )}
              {(aiReply || step === "loading") && (
                <div>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      margin: "0 0 3px 0",
                    }}
                  >
                    AI
                  </p>
                  <p
                    style={{
                      color: "white",
                      fontSize: "13px",
                      margin: 0,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {aiReply || "…"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={handleToggle}
        disabled={isBusy}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        style={{
          position: "fixed",
          bottom: "28px",
          right: "20px",
          zIndex: 9999,
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: isRecording
            ? "2px solid rgba(239,68,68,0.7)"
            : "2px solid rgba(255,255,255,0.15)",
          background: isRecording
            ? "rgba(239,68,68,0.2)"
            : "rgba(20,20,30,0.85)",
          backdropFilter: "blur(12px)",
          boxShadow: isRecording
            ? "0 0 24px rgba(239,68,68,0.35)"
            : "0 4px 24px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isBusy ? "default" : "pointer",
          transition: "border 0.2s, background 0.2s, box-shadow 0.2s",
        }}
      >
        {isBusy ? (
          <div
            style={{
              width: 24,
              height: 24,
              border: "2.5px solid rgba(255,255,255,0.15)",
              borderTop: "2.5px solid white",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        ) : isRecording ? (
          <div
            style={{
              width: 18,
              height: 18,
              background: "rgba(239,68,68,0.9)",
              borderRadius: "3px",
            }}
          />
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
