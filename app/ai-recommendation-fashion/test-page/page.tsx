"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import "../../../styles/glow.css";
import { ROUTES } from "@/navigation";
import {
  garmentService,
  type RemoteGarment,
} from "@/modules/shared/api/garment.service";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import { fileUploadService } from "@/modules/shared/api/file-upload.service";
import { tryOnService } from "@/modules/shared/api/try-on.service";
import { chatWonderService, type ChatWonderMessageResponse } from "@/modules/shared/api/chat-wonder.service";
import { FittingSlot } from "@/modules/garment/types";
import WeatherWidget from "@/components/WeatherWidget";
import OutfitPreviewCanvas, {
  type OutfitPreviewCanvasHandle,
} from "@/components/OutfitPreviewCanvas";

function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null) return;
      const delta = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseDown: (e: React.MouseEvent) => {
      startX.current = e.clientX;
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (startX.current === null) return;
      const delta = e.clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseLeave: () => {
      startX.current = null;
    },
  };
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex-1 h-px bg-white/20" />
      <span className="text-white text-xs font-bold tracking-widest uppercase">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/20" />
    </div>
  );
}

function SkeletonCell({
  ratio = "1/1",
  style,
}: {
  ratio?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="animate-pulse"
      style={{
        aspectRatio: ratio,
        background: "rgba(255,255,255,0.1)",
        borderRadius: "4px",
        ...style,
      }}
    />
  );
}

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

type RecordStep = "idle" | "recording" | "transcribing" | "loading" | "done" | "error";

function VoiceTranscribeOverlay({ onAiComplete }: { onAiComplete?: (response: ChatWonderMessageResponse) => void }) {
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
          weatherRef.current = {
            date: new Date().toISOString().split("T")[0],
            description: String(d.condition ?? "").toLowerCase(),
            estimated: false,
            is_cold: Number(d.temperature) < 20,
            is_hot: Number(d.temperature) >= 30,
            is_rainy:
              Number(d.precipitationProb) >= 50 ||
              String(d.condition ?? "").toLowerCase().includes("rain"),
            lat,
            lon,
            temperature_c: Number(d.temperature),
          };
        } catch {
          // weather is best-effort; stream works without it
        }
      },
      () => { /* geolocation denied — skip weather context */ },
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext({ sampleRate: VOICE_SAMPLE_RATE });
      const processor = ctx.createScriptProcessor(VOICE_BUFFER_SIZE, 1, 1);
      const source = ctx.createMediaStreamSource(stream);
      chunksRef.current = [];
      processor.onaudioprocess = (e) => {
        chunksRef.current.push(pcmFloat32ToInt16(e.inputBuffer.getChannelData(0)));
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
    const chunks = chunksRef.current;
    cleanupMic();

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const combined = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) { combined.set(c, offset); offset += c.length; }

    let rawText = "";
    try {
      const res = await fetch("/api/mirror/voice/transcribe?lang=en-US", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: combined.buffer,
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      rawText = (await res.text())?.trim();
      if (!rawText) {
        setErrorMsg("No speech detected");
        setStep("error");
        return;
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message ?? "Transcription failed");
      setStep("error");
      return;
    }

    const userInput = `[garments] ${rawText}`;
    setTranscript(userInput);
    setStep("loading");

    abortCtrlRef.current = new AbortController();
    try {
      const response = await chatWonderService.message(
        {
          input: userInput,
          ...(weatherRef.current ? { weather: weatherRef.current } : {}),
        },
        abortCtrlRef.current.signal,
      );
      setAiReply(response.message);
      setStep("done");
      onAiComplete?.(response);
    } catch (err: unknown) {
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

  const isRecording   = step === "recording";
  const isBusy        = step === "transcribing" || step === "loading";

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
            <p style={{ color: "rgba(239,68,68,0.9)", fontSize: "13px", margin: 0 }}>{errorMsg}</p>
          ) : (
            <>
              {transcript && (
                <div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>
                    You
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>
                    {transcript}
                  </p>
                </div>
              )}
              {(aiReply || step === "loading") && (
                <div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px 0" }}>
                    AI
                  </p>
                  <p style={{ color: "white", fontSize: "13px", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
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
          <div style={{ width: 18, height: 18, background: "rgba(239,68,68,0.9)", borderRadius: "3px" }} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </>
  );
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function VirtualMirrorV2() {
  const router = useRouter();
  const now = useClock();

  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(
    null,
  );
  const [selectedHat, setSelectedHat] = useState<RemoteGarment | null>(null);
  const [selectedBag, setSelectedBag] = useState<RemoteGarment | null>(null);
  const [selectedTop, setSelectedTop] = useState<RemoteGarment | null>(null);
  const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedShoe, setSelectedShoe] = useState<RemoteGarment | null>(null);
  const [loadingGarments, setLoadingGarments] = useState(true);
  const [loadingOutfits, setLoadingOutfits] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const previewRef = useRef<OutfitPreviewCanvasHandle>(null);
  type TryOnStep = "idle" | "uploading" | "running" | "polling" | "done" | "error";
  const [tryOnStep, setTryOnStep] = useState<TryOnStep>("idle");
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  function handleAiComplete(response: ChatWonderMessageResponse) {
    type AiItem = {
      id?: string;
      name: string;
      type?: string;
      description?: string;
      reason?: string;
      imageUrl?: string;
      category?: string | string[];
      garmentType?: string[];
      fittingSlot?: string[];
    };

    const newTops: RemoteGarment[]    = [];
    const newBottoms: RemoteGarment[] = [];
    const newShoes: RemoteGarment[]   = [];
    const seen = new Set<string>();

    const toGarment = (item: AiItem, slot: string): RemoteGarment => ({
      id: item.id ?? crypto.randomUUID(),
      name: item.name,
      description: item.reason ?? item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      fittingSlot: [slot],
      garmentType: item.garmentType ?? (item.type ? [item.type] : []),
      category: Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []),
      tags: [],
      gender: null,
      silhouette: null,
      layerLevel: null,
      file: null,
    });

    function push(item: AiItem | undefined, bucket: RemoteGarment[], slot: string) {
      if (!item?.id) return;
      if (seen.has(item.id)) return;
      seen.add(item.id);
      bucket.push(toGarment(item, slot));
    }

    // ── /message format: response.garment_data.sets[].recommendations[] ────────
    const sets = response.garment_data?.sets ?? [];
    for (const s of sets) {
      for (const r of (s.recommendations ?? []) as AiItem[]) {
        if (r.fittingSlot?.includes("UpperGarment")) push(r, newTops,    "UpperGarment");
        if (r.fittingSlot?.includes("LowerGarment")) push(r, newBottoms, "LowerGarment");
        if (r.fittingSlot?.includes("FootGarment"))  push(r, newShoes,   "FootGarment");
      }
    }

    if (newTops.length)    { setTops(newTops);       setTopsPage(0); }
    if (newBottoms.length) { setBottoms(newBottoms); setBottomsPage(0); }
    if (newShoes.length)   { setShoes(newShoes);     setShoesPage(0); }
  }

  const clearSlots = () => {
    setSelectedHat(null);
    setSelectedBag(null);
    setSelectedTop(null);
    setSelectedBottom(null);
    setSelectedShoe(null);
  };
  const selectOutfit = (idx: number) => {
    setSelectedOutfitIdx(idx);
    clearSlots();
  };

  function closeConfirmModal() {
    setShowConfirm(false);
    setTryOnStep("idle");
    setTryOnResult(null);
    setTryOnError(null);
  }

  async function pollTryOnStatus(predictionId: string): Promise<string> {
    const MAX_POLLS = 60;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await tryOnService.getStatus(predictionId);
      if (status.predictionStatus === "completed" && status.outputUrl)
        return status.outputUrl;
      if (status.predictionStatus === "failed" || status.error)
        throw new Error(status.error || "Try-on processing failed");
    }
    throw new Error("Try-on timed out after 2 minutes");
  }

  async function runTryOnPipeline() {
    setTryOnError(null);
    try {
      setTryOnStep("uploading");
      const blob = await previewRef.current?.getBlob();
      if (!blob) throw new Error("Failed to capture outfit preview");

      const { fileUrl: outfitImage } = await fileUploadService.upload(
        blob,
        "outfit-preview.png",
      );

      const gender = sessionStorage.getItem("mirror_gender");
      const modelImage =
        gender === "FEMALE"
          ? process.env.NEXT_PUBLIC_MODEL_FEMALE_URL
          : process.env.NEXT_PUBLIC_MODEL_MALE_URL;
      if (!modelImage) throw new Error("Model image URL not configured");

      setTryOnStep("running");
      const predictionId = await tryOnService.runByImages({
        modelImage,
        outfitImage,
        category: "one-pieces",
      });

      setTryOnStep("polling");
      const outputUrl = await pollTryOnStatus(predictionId);
      setTryOnResult(outputUrl);
      setTryOnStep("done");
    } catch (err: unknown) {
      setTryOnError(
        (err as { message?: string })?.message || "Something went wrong",
      );
      setTryOnStep("error");
    }
  }
  const outfitPageSize = 4;
  const [outfitPage, setOutfitPage] = useState(0);
  const totalOutfitPages = Math.max(
    1,
    Math.ceil(outfits.length / outfitPageSize),
  );
  const pagedOutfits = outfits.slice(
    outfitPage * outfitPageSize,
    (outfitPage + 1) * outfitPageSize,
  );
  const outfitSwipe = useSwipe(
    () => setOutfitPage((p) => Math.min(p + 1, totalOutfitPages - 1)),
    () => setOutfitPage((p) => Math.max(p - 1, 0)),
  );

  const pageSize = 8;
  const shoesPageSize = 6;
  const accessoryPageSize = 3;

  const [tops, setTops] = useState<RemoteGarment[]>([]);
  const [topsPage, setTopsPage] = useState(0);
  const totalTopsPages = Math.ceil(tops.length / pageSize);
  const pagedTops = tops.slice(topsPage * pageSize, (topsPage + 1) * pageSize);
  const topsSwipe = useSwipe(
    () => setTopsPage((p) => Math.min(p + 1, totalTopsPages - 1)),
    () => setTopsPage((p) => Math.max(p - 1, 0)),
  );

  const [shoes, setShoes] = useState<RemoteGarment[]>([]);
  const [shoesPage, setShoesPage] = useState(0);
  const totalShoesPages = Math.ceil(shoes.length / shoesPageSize);
  const pagedShoes = shoes.slice(
    shoesPage * shoesPageSize,
    (shoesPage + 1) * shoesPageSize,
  );
  const shoesSwipe = useSwipe(
    () => setShoesPage((p) => Math.min(p + 1, totalShoesPages - 1)),
    () => setShoesPage((p) => Math.max(p - 1, 0)),
  );

  const [bottoms, setBottoms] = useState<RemoteGarment[]>([]);
  const [bottomsPage, setBottomsPage] = useState(0);
  const totalBottomsPages = Math.ceil(bottoms.length / pageSize);
  const pagedBottoms = bottoms.slice(
    bottomsPage * pageSize,
    (bottomsPage + 1) * pageSize,
  );
  const bottomsSwipe = useSwipe(
    () => setBottomsPage((p) => Math.min(p + 1, totalBottomsPages - 1)),
    () => setBottomsPage((p) => Math.max(p - 1, 0)),
  );

  const [headGarments, setHeadGarments] = useState<RemoteGarment[]>([]);
  const [, setGlasses] = useState<RemoteGarment[]>([]);
  const [, setEarrings] = useState<RemoteGarment[]>([]);
  const [, setNeckAccessories] = useState<RemoteGarment[]>([]);
  const [, setWaistAccessories] = useState<RemoteGarment[]>([]);
  const [, setBracelets] = useState<RemoteGarment[]>([]);
  const [, setWatches] = useState<RemoteGarment[]>([]);
  const [bags, setBags] = useState<RemoteGarment[]>([]);

  const [headGarmentsPage, setHeadGarmentsPage] = useState(0);
  const totalHeadGarmentsPages = Math.ceil(
    headGarments.length / accessoryPageSize,
  );
  const pagedHeadGarments = headGarments.slice(
    headGarmentsPage * accessoryPageSize,
    (headGarmentsPage + 1) * accessoryPageSize,
  );
  const headSwipe = useSwipe(
    () =>
      setHeadGarmentsPage((p) => Math.min(p + 1, totalHeadGarmentsPages - 1)),
    () => setHeadGarmentsPage((p) => Math.max(p - 1, 0)),
  );

  const [bagsPage, setBagsPage] = useState(0);
  const totalBagsPages = Math.ceil(bags.length / accessoryPageSize);
  const pagedBags = bags.slice(
    bagsPage * accessoryPageSize,
    (bagsPage + 1) * accessoryPageSize,
  );
  const bagSwipe = useSwipe(
    () => setBagsPage((p) => Math.min(p + 1, totalBagsPages - 1)),
    () => setBagsPage((p) => Math.max(p - 1, 0)),
  );

  useEffect(() => {
    // Garment grids resolve independently from the outfit grid
    Promise.allSettled([
      garmentService
        .getBySlot(FittingSlot.UpperGarment)
        .then(setTops)
        .catch((err) => console.error("[Tops] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.LowerGarment)
        .then(setBottoms)
        .catch((err) => console.error("[Bottoms] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.FootGarment)
        .then(setShoes)
        .catch((err) => console.error("[Shoes] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.HeadGarment)
        .then(setHeadGarments)
        .catch((err) => console.error("[HeadGarment] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.Glasses)
        .then(setGlasses)
        .catch((err) => console.error("[Glasses] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.Earrings)
        .then(setEarrings)
        .catch((err) => console.error("[Earrings] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.NeckAccessory)
        .then(setNeckAccessories)
        .catch((err) => console.error("[NeckAccessory] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.WaistAccessory)
        .then(setWaistAccessories)
        .catch((err) => console.error("[WaistAccessory] fetch error:", err)),
      garmentService
        .getBySlotAndType(FittingSlot.RightHandAccessory, "Bracelet")
        .then(setBracelets)
        .catch((err) => console.error("[Bracelet] fetch error:", err)),
      garmentService
        .getBySlotAndType(FittingSlot.RightHandAccessory, "Watch")
        .then(setWatches)
        .catch((err) => console.error("[Watch] fetch error:", err)),
      garmentService
        .getBySlotAndType(FittingSlot.RightHandAccessory, "Bag")
        .then(setBags)
        .catch((err) => console.error("[Bag] fetch error:", err)),
    ]).finally(() => setLoadingGarments(false));

    outfitService
      .getAll()
      .then(setOutfits)
      .catch((err) => console.error("[Outfits] fetch error:", err))
      .finally(() => setLoadingOutfits(false));
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <header
        className={"flex items-center shrink-0 py-4 px-4"}
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            alignItems: "center",
          }}
        >
          <WeatherWidget iconSize={32} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
            width: "50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            className="text-white font-thin select-none shrink-0"
            style={{ fontSize: "3rem", lineHeight: 1 }}
          >
            {time}
          </span>
          <span className="text-white/80 text-xl font-light select-none shrink-0">
            {day}, {date}
          </span>
        </div>
        <div
          style={{
            flex: "0 0 25%",
            width: "25%",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => router.push(ROUTES.LOGGED_IN)}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>

      {/* AI Suggestion Banner */}
      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      <div className="flex flex-1" style={{ height: "546px" }}>
        {/* Left panel — Accessories */}
        <div
          className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
          style={{ flex: "0 0 25%", width: "25%" }}
        >
          <div className="flex flex-col gap-1">
            <SectionTitle label="Accessories" />

            <div
              {...headSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
                marginBottom: "5px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "4px",
                }}
                className="glass-card"
              >
                {!loadingGarments && headGarments.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "60px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      border: "1px dashed rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                    }}
                  >
                    No accessories
                  </div>
                ) : (
                  Array.from({ length: accessoryPageSize }).map((_, i) => {
                    if (loadingGarments)
                      return (
                        <SkeletonCell
                          key={i}
                          style={{ marginTop: "5px", marginBottom: "5px" }}
                        />
                      );
                    const g = pagedHeadGarments[i];
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          g && (setSelectedHat(g), setSelectedOutfitIdx(null))
                        }
                        className="rounded-md overflow-hidden flex items-center justify-center"
                        style={{
                          aspectRatio: "1/1",
                          borderRadius: "4px",
                          marginTop: "5px",
                          marginBottom: "5px",
                          cursor: g ? "pointer" : "default",
                          border:
                            g && selectedHat?.id === g.id
                              ? "1.5px solid rgba(255,255,255,0.6)"
                              : "1.5px solid transparent",
                        }}
                      >
                        {g?.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({
                  length: Math.max(1, totalHeadGarmentsPages),
                }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHeadGarmentsPage(i)}
                    aria-label={`Go to page ${i + 1}`}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === headGarmentsPage ? 12 : 4,
                      height: 4,
                      background:
                        i === headGarmentsPage
                          ? "white"
                          : "rgba(255,255,255,0.3)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* bag */}
            <div
              {...bagSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
                marginBottom: "5px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "4px",
                }}
                className="glass-card"
              >
                {!loadingGarments && bags.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "60px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      border: "1px dashed rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                    }}
                  >
                    No bags
                  </div>
                ) : (
                  Array.from({ length: accessoryPageSize }).map((_, i) => {
                    if (loadingGarments)
                      return (
                        <SkeletonCell
                          key={i}
                          style={{ marginTop: "5px", marginBottom: "5px" }}
                        />
                      );
                    const g = pagedBags[i];
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          g && (setSelectedBag(g), setSelectedOutfitIdx(null))
                        }
                        className="rounded-md overflow-hidden flex items-center justify-center"
                        style={{
                          aspectRatio: "1/1",
                          borderRadius: "4px",
                          marginTop: "5px",
                          marginBottom: "5px",
                          cursor: g ? "pointer" : "default",
                          border:
                            g && selectedBag?.id === g.id
                              ? "1.5px solid rgba(255,255,255,0.6)"
                              : "1.5px solid transparent",
                        }}
                      >
                        {g?.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({ length: totalBagsPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBagsPage(i)}
                    aria-label={`Go to page ${i + 1}`}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === bagsPage ? 12 : 4,
                      height: 4,
                      background:
                        i === bagsPage ? "white" : "rgba(255,255,255,0.3)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <SectionTitle label="Outfit" />
            <div
              {...outfitSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(1, 1fr)",
                  gridTemplateRows: "repeat(4, 1fr)",
                  gap: "6px",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {loadingOutfits ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCell
                      key={i}
                      style={{ borderRadius: "10px", aspectRatio: "unset", height: "100%" }}
                    />
                  ))
                ) : outfits.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "160px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      border: "1px dashed rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                    }}
                  >
                    No outfits created
                  </div>
                ) : (
                  pagedOutfits.map((outfit, i) => {
                    const globalIdx = outfitPage * outfitPageSize + i;
                    return (
                      <div
                        key={outfit.id}
                        onClick={() => selectOutfit(globalIdx)}
                        style={{
                          position: "relative",
                          borderRadius: "10px",
                          overflow: "hidden",
                          background: "rgba(255,255,255,0.01)",
                          cursor: "pointer",
                          border:
                            selectedOutfitIdx === globalIdx
                              ? "2px solid rgba(255,255,255,0.6)"
                              : "2px solid transparent",
                          transition: "border-color 0.2s",
                        }}
                      >
                        {outfit.file?.fileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={outfit.file.fileUrl}
                            alt={outfit.name}
                            draggable={false}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                color: "rgba(255,255,255,0.2)",
                                fontSize: "11px",
                              }}
                            >
                              {outfit.name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({ length: totalOutfitPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setOutfitPage(i)}
                    style={{
                      width: i === outfitPage ? 12 : 4,
                      height: 4,
                      borderRadius: "9999px",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      background:
                        i === outfitPage ? "white" : "rgba(255,255,255,0.3)",
                      transition: "all 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center panel */}
        {(() => {
          const selectedOutfit =
            selectedOutfitIdx !== null
              ? (outfits[selectedOutfitIdx] ?? null)
              : null;
          return (
            <div
              className="h-full flex flex-col items-center pt-8 gap-1 overflow-hidden"
              style={{ flex: "0 0 50%", width: "50%", minHeight: 0 }}
            >
              {/* Outfit display */}
              {selectedOutfit && (
                <div
                  style={{
                    width: "100%",
                    padding: "0 12px",
                    paddingBottom: "145px",
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    overflow: "hidden",
                  }}
                >
                  {/* Image — proportional flex share, no fixed height */}
                  <div
                    style={{
                      flex: "2 1 0",
                      minHeight: 0,
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "rgba(255,255,255,0.01)",
                    }}
                  >
                    {selectedOutfit.file?.fileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedOutfit.file.fileUrl}
                        alt={selectedOutfit.name}
                        draggable={false}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.2)",
                            fontSize: "12px",
                          }}
                        >
                          No Image
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Name & description — fixed, description clipped to 2 lines */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    <span
                      style={{
                        color: "white",
                        fontSize: "13px",
                        fontWeight: 700,
                        lineHeight: 1.3,
                        overflow: "hidden",
                      }}
                    >
                      {selectedOutfit.name}
                    </span>
                    {selectedOutfit.description && (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: "10px",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          maxHeight: "3em",
                        }}
                      >
                        {selectedOutfit.description}
                      </span>
                    )}
                  </div>
                  {/* Garment cards — remaining flex space, each card grows equally */}
                  {selectedOutfit.items.length > 0 && (
                    <div
                      style={{
                        flex: "3 1 0",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        overflow: "hidden",
                      }}
                    >
                      {selectedOutfit.items
                        .slice()
                        .sort((a, b) => {
                          const UPPER = [
                            "Shirt",
                            "TShirt",
                            "Polo",
                            "Blouse",
                            "Hoodie",
                            "Sweater",
                            "Jacket",
                            "Coat",
                            "Blazer",
                          ];
                          const LOWER = ["Pants", "Jeans", "Shorts", "Skirt"];
                          const FOOT = [
                            "Shoes",
                            "Sneakers",
                            "Sandals",
                            "Boots",
                            "Heels",
                            "Socks",
                          ];
                          const HEAD = ["Hat", "Beanie", "Cap", "Headband"];
                          const rank = (types: string[]) => {
                            const t = types[0] ?? "";
                            if (UPPER.includes(t)) return 0;
                            if (LOWER.includes(t)) return 1;
                            if (FOOT.includes(t)) return 2;
                            if (HEAD.includes(t)) return 3;
                            return 4;
                          };
                          return (
                            rank(a.garment.garmentType) -
                            rank(b.garment.garmentType)
                          );
                        })
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex"
                            style={{
                              flex: "1 1 0",
                              minHeight: 0,
                              width: "100%",
                              alignItems: "stretch",
                              overflow: "hidden",
                              background: "transparent",
                            }}
                          >
                            <div
                              style={{
                                flex: "0 0 38%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "8px 0 0 8px",
                                overflow: "hidden",
                              }}
                            >
                              {item.garment.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.garment.imageUrl}
                                  alt={item.garment.name}
                                  draggable={false}
                                  className="w-full h-full object-contain pointer-events-none"
                                />
                              ) : (
                                <span
                                  style={{
                                    color: "rgba(255,255,255,0.25)",
                                    fontSize: "10px",
                                  }}
                                >
                                  No Image
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: "5px 8px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                gap: "2px",
                                overflow: "hidden",
                              }}
                            >
                              <span
                                style={{
                                  color: "rgba(255,255,255,255,0.01)",
                                  fontSize: "8px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.garment.garmentType[0]}
                              </span>
                              <span
                                style={{
                                  color: "white",
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  lineHeight: 1.3,
                                  overflow: "hidden",
                                }}
                              >
                                {item.garment.name}
                              </span>
                              <span
                                style={{
                                  color: "rgba(255,255,255,0.45)",
                                  fontSize: "9px",
                                  lineHeight: 1.4,
                                  overflow: "hidden",
                                }}
                              >
                                {item.garment.description}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Garment slot cards */}
              {!selectedOutfit && (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    padding: "0 10px 88px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    overflow: "hidden",
                    background: "transparent",
                  }}
                >
                  {[
                    selectedHat,
                    selectedBag,
                    selectedTop,
                    selectedBottom,
                    selectedShoe,
                  ]
                    .filter((g): g is RemoteGarment => g !== null)
                    .sort((a, b) => {
                      const UPPER = [
                        "Shirt",
                        "TShirt",
                        "Polo",
                        "Blouse",
                        "Hoodie",
                        "Sweater",
                        "Jacket",
                        "Coat",
                        "Blazer",
                      ];
                      const LOWER = ["Pants", "Jeans", "Shorts", "Skirt"];
                      const FOOT = [
                        "Shoes",
                        "Sneakers",
                        "Sandals",
                        "Boots",
                        "Heels",
                        "Socks",
                      ];
                      const HEAD = ["Hat", "Beanie", "Cap", "Headband"];
                      const rank = (types: string[]) => {
                        const t = types[0] ?? "";
                        if (UPPER.includes(t)) return 0;
                        if (LOWER.includes(t)) return 1;
                        if (FOOT.includes(t)) return 2;
                        if (HEAD.includes(t)) return 3;
                        return 4;
                      };
                      return rank(a.garmentType) - rank(b.garmentType);
                    })
                    .map((g) => (
                      <div
                        key={g.id}
                        className="flex"
                        style={{
                          flexShrink: 0,
                          height: "110px",
                          width: "100%",
                          alignItems: "stretch",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            flex: "0 0 38%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "8px 0 0 8px",
                            overflow: "hidden",
                          }}
                        >
                          {g.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={g.imageUrl}
                              alt={g.name}
                              draggable={false}
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          ) : (
                            <span
                              style={{
                                color: "rgba(255,255,255,0.25)",
                                fontSize: "10px",
                              }}
                            >
                              No Image
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: "8px 10px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {g.garmentType[0]}
                          </span>
                          <span
                            style={{
                              color: "white",
                              fontSize: "12px",
                              fontWeight: 600,
                              lineHeight: 1.3,
                              overflow: "hidden",
                            }}
                          >
                            {g.name}
                          </span>
                          <span
                            style={{
                              color: "rgba(255,255,255,0.45)",
                              fontSize: "10px",
                              lineHeight: 1.4,
                              overflow: "hidden",
                            }}
                          >
                            {g.description}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Right panel — Tops / Bottoms / Shoes */}
        <div
          className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
          style={{ flex: "0 0 25%", width: "25%" }}
        >
          <div className="flex flex-col gap-1">
            <SectionTitle label="Tops" />
            <div
              {...topsSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "4px",
                }}
              >
                {!loadingGarments && tops.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "120px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      border: "1px dashed rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                    }}
                  >
                    No tops
                  </div>
                ) : (
                  Array.from({ length: pageSize }).map((_, i) => {
                    if (loadingGarments) return <SkeletonCell key={i} />;
                    const g = pagedTops[i];
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          g && (setSelectedTop(g), setSelectedOutfitIdx(null))
                        }
                        className="rounded-md overflow-hidden flex items-center justify-center"
                        style={{
                          aspectRatio: "1/1",
                          borderRadius: "4px",
                          cursor: g ? "pointer" : "default",
                          border:
                            g && selectedTop?.id === g.id
                              ? "1.5px solid rgba(255,255,255,0.6)"
                              : "1.5px solid transparent",
                        }}
                      >
                        {g?.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({ length: Math.max(1, totalTopsPages) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === topsPage ? 12 : 4,
                        height: 4,
                        background:
                          i === topsPage ? "white" : "rgba(255,255,255,0.3)",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <SectionTitle label="Bottoms" />
            <div
              {...bottomsSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "4px",
                }}
              >
                {!loadingGarments && bottoms.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "120px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      border: "1px dashed rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                    }}
                  >
                    No bottoms
                  </div>
                ) : (
                  Array.from({ length: pageSize }).map((_, i) => {
                    if (loadingGarments) return <SkeletonCell key={i} />;
                    const g = pagedBottoms[i];
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          g &&
                          (setSelectedBottom(g), setSelectedOutfitIdx(null))
                        }
                        className="rounded-md overflow-hidden flex items-center justify-center"
                        style={{
                          aspectRatio: "1/1",
                          borderRadius: "4px",
                          cursor: g ? "pointer" : "default",
                          border:
                            g && selectedBottom?.id === g.id
                              ? "1.5px solid rgba(255,255,255,0.6)"
                              : "1.5px solid transparent",
                        }}
                      >
                        {g?.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({ length: Math.max(1, totalBottomsPages) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === bottomsPage ? 12 : 4,
                        height: 4,
                        background:
                          i === bottomsPage ? "white" : "rgba(255,255,255,0.3)",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <SectionTitle label="Shoes" />
            <div
              {...shoesSwipe}
              style={{
                touchAction: "pan-y",
                userSelect: "none",
                cursor: "grab",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "4px",
                }}
              >
                {!loadingGarments && shoes.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      height: "90px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "12px",
                      border: "1px dashed rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                    }}
                  >
                    No shoes
                  </div>
                ) : (
                  Array.from({ length: shoesPageSize }).map((_, i) => {
                    if (loadingGarments) return <SkeletonCell key={i} />;
                    const g = pagedShoes[i];
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          g && (setSelectedShoe(g), setSelectedOutfitIdx(null))
                        }
                        className="rounded-md overflow-hidden flex items-center justify-center"
                        style={{
                          aspectRatio: "1/1",
                          borderRadius: "4px",
                          cursor: g ? "pointer" : "default",
                          border:
                            g && selectedShoe?.id === g.id
                              ? "1.5px solid rgba(255,255,255,0.6)"
                              : "1.5px solid transparent",
                        }}
                      >
                        {g?.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.imageUrl}
                            alt={g.name}
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {Array.from({ length: Math.max(1, totalShoesPages) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === shoesPage ? 12 : 4,
                        height: 4,
                        background:
                          i === shoesPage ? "white" : "rgba(255,255,255,0.3)",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Outfit — fixed to viewport bottom center, hidden when outfit is selected */}
      {selectedOutfitIdx === null && (
        <button
          style={{
            position: "fixed",
            bottom: "28px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            padding: "14px 52px",
            background: "#ffffff",
            color: "#000",
            border: "none",
            borderRadius: "14px",
            fontSize: "16px",
            fontWeight: "700",
            cursor: "pointer",
            letterSpacing: "0.4px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            transition: "opacity 0.2s, transform 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseDown={(e) =>
            (e.currentTarget.style.transform = "translateX(-50%) scale(0.97)")
          }
          onMouseUp={(e) =>
            (e.currentTarget.style.transform = "translateX(-50%) scale(1)")
          }
          onClick={() => {
            setTryOnResult(null);
            setTryOnError(null);
            setShowConfirm(true);
            runTryOnPipeline();
          }}
        >
          Create Outfit
        </button>
      )}

      {/* Hidden canvas — always mounted so getBlob() is ready before modal opens */}
      <div
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <OutfitPreviewCanvas
          ref={previewRef}
          hat={selectedHat}
          top={selectedTop}
          bottom={selectedBottom}
          shoe={selectedShoe}
          bag={selectedBag}
        />
      </div>

      {/* Try-on modal */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={tryOnStep === "done" || tryOnStep === "error" ? closeConfirmModal : undefined}
        >
          <div
            style={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "20px",
              padding: "32px 28px",
              width: "360px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <p style={{ color: "white", fontSize: "20px", fontWeight: "700", textAlign: "center", margin: 0 }}>
              {tryOnStep === "done" ? "Your Look" : tryOnStep === "error" ? "Something went wrong" : "Generating your look…"}
            </p>

            {/* Status text */}
            {(tryOnStep === "uploading" || tryOnStep === "running" || tryOnStep === "polling") && (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", margin: 0 }}>
                {tryOnStep === "uploading" && "Uploading outfit…"}
                {tryOnStep === "running" && "Starting try-on…"}
                {tryOnStep === "polling" && "Processing — this may take a moment…"}
              </p>
            )}
            {tryOnStep === "error" && (
              <p style={{ color: "rgba(239,68,68,0.9)", fontSize: "13px", textAlign: "center", margin: 0 }}>
                {tryOnError}
              </p>
            )}

            {/* Result / loading area */}
            <div
              style={{
                width: "100%",
                aspectRatio: "2/3",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#1a1a1a",
                marginTop: "4px",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Spinner while processing */}
              {(tryOnStep === "uploading" || tryOnStep === "running" || tryOnStep === "polling") && (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    border: "3px solid rgba(255,255,255,0.15)",
                    borderTop: "3px solid white",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              )}

              {/* Error icon */}
              {tryOnStep === "error" && (
                <span style={{ fontSize: 40, opacity: 0.4 }}>✕</span>
              )}

              {/* Result image */}
              {tryOnStep === "done" && tryOnResult && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tryOnResult}
                  alt="Try-on result"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px", marginTop: "4px", width: "100%" }}>
              {tryOnStep === "error" && (
                <>
                  <button
                    style={{
                      flex: 1, padding: "12px", background: "transparent",
                      border: "1px solid rgba(255,255,255,0.2)", borderRadius: "12px",
                      color: "white", fontSize: "15px", fontWeight: "600", cursor: "pointer",
                    }}
                    onClick={closeConfirmModal}
                  >
                    Close
                  </button>
                  <button
                    style={{
                      flex: 1, padding: "12px", background: "#ffffff",
                      border: "none", borderRadius: "12px",
                      color: "#000", fontSize: "15px", fontWeight: "700", cursor: "pointer",
                    }}
                    onClick={runTryOnPipeline}
                  >
                    Retry
                  </button>
                </>
              )}

              {tryOnStep === "done" && (
                <button
                  style={{
                    flex: 1, padding: "12px", background: "#ffffff",
                    border: "none", borderRadius: "12px",
                    color: "#000", fontSize: "15px", fontWeight: "700", cursor: "pointer",
                  }}
                  onClick={closeConfirmModal}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <VoiceTranscribeOverlay onAiComplete={(r) => handleAiComplete(r)} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
