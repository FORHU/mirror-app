"use client";

import { useEffect, useRef, useState } from "react";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";

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

  const recognitionRef = useRef<any>(null);
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
    if (recognitionRef.current) {
      recognitionRef.current.onstart = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
  }

  useEffect(() => {
    return () => cleanupMic();
  }, []);

  async function startRecording() {
    setErrorMsg("");
    setTranscript("");
    setAiReply("");
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setErrorMsg("Speech recognition is not supported in this browser.");
        setStep("error");
        return;
      }
      cleanupMic();
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;

      let accumulated = "";
      let latestInterim = "";

      recognition.onstart = () => setStep("recording");
      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setErrorMsg("Speech recognition error: " + event.error);
          setStep("error");
        }
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          accumulated += (accumulated ? " " : "") + finalTranscript;
        }
        latestInterim = interimTranscript;

        setTranscript(accumulated + (latestInterim ? " " + latestInterim : ""));
      };

      recognition.onend = () => {
        const finalText = (
          accumulated + (latestInterim ? " " + latestInterim : "")
        ).trim();
        if (finalText) {
          submitTranscript(finalText);
        } else {
          // If we didn't capture any speech, reset state
          setStep((prev) =>
            prev === "recording" || prev === "transcribing" ? "idle" : prev,
          );
        }
      };

      recognition.start();
    } catch {
      setErrorMsg("Microphone access denied or error starting recognition");
      setStep("error");
    }
  }

  async function stopAndTranscribe() {
    setStep("transcribing");
    if (recognitionRef.current) {
      recognitionRef.current.stop(); // This triggers onend which submits the transcript
    } else {
      setStep("idle");
    }
  }

  async function submitTranscript(rawText: string) {
    setStep("loading");
    onLoadingChange?.(true);

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
      if ((err as any).name === "AbortError") return;
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
