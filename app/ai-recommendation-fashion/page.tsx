"use client";

import { useEffect, useRef, useState } from "react";
import "../../styles/glow.css";
import {
  garmentService,
  type RemoteGarment,
} from "@/modules/shared/api/garment.service";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import {
  chatWonderService,
  type ChatWonderMessageResponse,
} from "@/modules/shared/api/chat-wonder.service";
import { FittingSlot } from "@/modules/garment/types";
import MirrorHeader from "@/components/MirrorHeader";
import OutfitPreviewCanvas from "@/components/OutfitPreviewCanvas";

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

type RecordStep =
  | "idle"
  | "recording"
  | "transcribing"
  | "loading"
  | "done"
  | "error";

function VoiceTranscribeOverlay({ onAiComplete, onLoadingChange }: {
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
              String(d.condition ?? "")
                .toLowerCase()
                .includes("rain"),
            lat,
            lon,
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
          input: `[garments] ${rawText}`,
          ...(weatherRef.current ? { weather: weatherRef.current } : {}),
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
    </>
  );
}

export default function VirtualMirrorV2() {
  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(
    null,
  );
  const [selectedBag, setSelectedBag] = useState<RemoteGarment | null>(null);
  const [selectedTopBase, setSelectedTopBase] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedTopMid, setSelectedTopMid] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedTopOuter, setSelectedTopOuter] =
    useState<RemoteGarment | null>(null);
  const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedShoe, setSelectedShoe] = useState<RemoteGarment | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const aiPopulatedRef = useRef({
    tops: false,
    bottoms: false,
    shoes: false,
    bags: false,
    outfits: false,
  });

  type SwapSlot = "base" | "mid" | "outer" | "bottoms" | "shoes" | "bags";
  const [swapSlot, setSwapSlot] = useState<SwapSlot | null>(null);
  const [swapItemId, setSwapItemId] = useState<string | null>(null);
  const [outfitOverrides, setOutfitOverrides] = useState<Record<string, RemoteGarment>>({});
  const outfitModified = Object.keys(outfitOverrides).length > 0;

  function resolveSwapSlot(garmentType: string[], fittingSlot: string[]): SwapSlot {
    if (garmentType.includes("Bag")) return "bags";
    if (fittingSlot.includes("LowerGarment")) return "bottoms";
    if (fittingSlot.includes("FootGarment")) return "shoes";
    const t = garmentType[0] ?? "";
    if (["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"].includes(t)) return "outer";
    if (["Hoodie", "Sweater", "Cardigan", "Pullover"].includes(t)) return "mid";
    return "base";
  }

  function applySwap(g: RemoteGarment) {
    if (!swapItemId) return;
    setOutfitOverrides((prev) => ({ ...prev, [swapItemId]: g }));
    setSwapSlot(null);
    setSwapItemId(null);
  }

  function cancelSwap() {
    setSwapSlot(null);
    setSwapItemId(null);
  }

  function handleAiComplete(response: ChatWonderMessageResponse) {
    setSelectedBag(null);
    setSelectedTopBase(null);
    setSelectedTopMid(null);
    setSelectedTopOuter(null);
    setSelectedBottom(null);
    setSelectedShoe(null);
    setSelectedOutfitIdx(null);

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
      layerLevel?: string;
    };

    const newTopsBase: RemoteGarment[] = [];
    const newTopsMid: RemoteGarment[] = [];
    const newTopsOuter: RemoteGarment[] = [];
    const newBottoms: RemoteGarment[] = [];
    const newShoes: RemoteGarment[] = [];
    const newBags: RemoteGarment[] = [];
    const seen = new Set<string>();

    const toGarment = (item: AiItem, slot: string): RemoteGarment => ({
      id: item.id ?? crypto.randomUUID(),
      name: item.name,
      description: item.reason ?? item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      fittingSlot: [slot],
      garmentType: item.garmentType ?? (item.type ? [item.type] : []),
      category: Array.isArray(item.category)
        ? item.category
        : item.category
          ? [item.category]
          : [],
      tags: [],
      gender: null,
      silhouette: null,
      layerLevel: item.layerLevel ?? null,
      file: null,
    });

    function push(
      item: AiItem | undefined,
      bucket: RemoteGarment[],
      slot: string,
    ) {
      if (!item?.id) return;
      if (seen.has(item.id)) return;
      seen.add(item.id);
      bucket.push(toGarment(item, slot));
    }

    // ── /message format: response.garment_data.sets[].recommendations[] ────────
    const sets = response.garment_data?.sets ?? [];
    for (const s of sets) {
      for (const r of (s.recommendations ?? []) as AiItem[]) {
        if (r.fittingSlot?.includes("UpperGarment")) {
          const layer = r.layerLevel ?? "BASE";
          if (layer === "OUTER") push(r, newTopsOuter, "UpperGarment");
          else if (layer === "MID") push(r, newTopsMid, "UpperGarment");
          else push(r, newTopsBase, "UpperGarment");
        }
        if (r.fittingSlot?.includes("LowerGarment"))
          push(r, newBottoms, "LowerGarment");
        if (r.fittingSlot?.includes("FootGarment"))
          push(r, newShoes, "FootGarment");
        if (r.garmentType?.includes("Bag"))
          push(r, newBags, "RightHandAccessory");
      }
    }

    aiPopulatedRef.current.tops = true;
    aiPopulatedRef.current.bottoms = true;
    aiPopulatedRef.current.shoes = true;
    aiPopulatedRef.current.bags = true;
    aiPopulatedRef.current.outfits = true;

    setTopsBase(newTopsBase);
    setTopsBasePage(0);
    setTopsMid(newTopsMid);
    setTopsMidPage(0);
    setTopsOuter(newTopsOuter);
    setTopsOuterPage(0);
    setBottoms(newBottoms);
    setBottomsPage(0);
    setShoes(newShoes);
    setShoesPage(0);
    setBags(newBags);
    setBagsPage(0);

    const newAiOutfits: RemoteOutfit[] = sets
      .filter((s) => s.outfit_imageUrl)
      .map((s) => ({
        id: s.outfit_id,
        name: s.outfit_name,
        description: s.reason,
        file: { fileUrl: s.outfit_imageUrl },
        items: s.recommendations.map((r) => ({
          id: r.id,
          slot: r.fittingSlot[0] ?? "UpperGarment",
          garment: {
            id: r.id,
            name: r.name,
            description: r.description,
            imageUrl: r.imageUrl,
            garmentType: r.garmentType,
            fittingSlot: r.fittingSlot,
          },
        })),
        metaData: null,
      }));
    setOutfits(newAiOutfits);
    setOutfitPage(0);
  }

  const clearSlots = () => {
    setSelectedBag(null);
    setSelectedTopBase(null);
    setSelectedTopMid(null);
    setSelectedTopOuter(null);
    setSelectedBottom(null);
    setSelectedShoe(null);
  };
  const selectOutfit = (idx: number) => {
    setSelectedOutfitIdx(idx);
    clearSlots();
    setOutfitOverrides({});
    setSwapSlot(null);
    setSwapItemId(null);
  };

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
  const accessoryPageSize = 6;
  const topsLayerPageSize = 2;

  const [topsBase, setTopsBase] = useState<RemoteGarment[]>([]);
  const [topsMid, setTopsMid] = useState<RemoteGarment[]>([]);
  const [topsOuter, setTopsOuter] = useState<RemoteGarment[]>([]);

  const [topsBasePage, setTopsBasePage] = useState(0);
  const [topsMidPage, setTopsMidPage] = useState(0);
  const [topsOuterPage, setTopsOuterPage] = useState(0);

  const totalTopsBasePages = Math.ceil(topsBase.length / topsLayerPageSize);
  const totalTopsMidPages = Math.ceil(topsMid.length / topsLayerPageSize);
  const totalTopsOuterPages = Math.ceil(topsOuter.length / topsLayerPageSize);

  const pagedTopsBase = topsBase.slice(
    topsBasePage * topsLayerPageSize,
    (topsBasePage + 1) * topsLayerPageSize,
  );
  const pagedTopsMid = topsMid.slice(
    topsMidPage * topsLayerPageSize,
    (topsMidPage + 1) * topsLayerPageSize,
  );
  const pagedTopsOuter = topsOuter.slice(
    topsOuterPage * topsLayerPageSize,
    (topsOuterPage + 1) * topsLayerPageSize,
  );

  const topsBaseSwipe = useSwipe(
    () => setTopsBasePage((p) => Math.min(p + 1, totalTopsBasePages - 1)),
    () => setTopsBasePage((p) => Math.max(p - 1, 0)),
  );
  const topsMidSwipe = useSwipe(
    () => setTopsMidPage((p) => Math.min(p + 1, totalTopsMidPages - 1)),
    () => setTopsMidPage((p) => Math.max(p - 1, 0)),
  );
  const topsOuterSwipe = useSwipe(
    () => setTopsOuterPage((p) => Math.min(p + 1, totalTopsOuterPages - 1)),
    () => setTopsOuterPage((p) => Math.max(p - 1, 0)),
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

  const [, setGlasses] = useState<RemoteGarment[]>([]);
  const [, setEarrings] = useState<RemoteGarment[]>([]);
  const [, setNeckAccessories] = useState<RemoteGarment[]>([]);
  const [, setWaistAccessories] = useState<RemoteGarment[]>([]);
  const [, setBracelets] = useState<RemoteGarment[]>([]);
  const [, setWatches] = useState<RemoteGarment[]>([]);
  const [bags, setBags] = useState<RemoteGarment[]>([]);

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
    let cancelled = false;
    const ctrl = new AbortController();

    async function fetchAiRecommendations() {
      let weather: Record<string, unknown> | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          }),
        );
        const { latitude: lat, longitude: lon } = pos.coords;
        const res = await fetch(`/api/mirror/weather?lat=${lat}&lng=${lon}`);
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
            lat,
            lon,
            temperature_c: Number(d.temperature),
          };
        }
      } catch {
        // weather is best-effort
      }

      if (cancelled) return;

      try {
        const response = await chatWonderService.message(
          {
            input: "[garments] recommend outfits for today",
            ...(weather ? { weather } : {}),
          },
          ctrl.signal,
        );
        if (!cancelled) handleAiComplete(response);
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }

    fetchAiRecommendations();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    // Garment grids resolve independently from the outfit grid
    Promise.allSettled([
      garmentService
        .getBySlot(FittingSlot.UpperGarment)
        .then((data) => {
          if (!aiPopulatedRef.current.tops) {
            setTopsBase(
              data.filter((g) => (g.layerLevel ?? "BASE") === "BASE"),
            );
            setTopsMid(data.filter((g) => g.layerLevel === "MID"));
            setTopsOuter(data.filter((g) => g.layerLevel === "OUTER"));
          }
        })
        .catch((err) => console.error("[Tops] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.LowerGarment)
        .then((data) => {
          if (!aiPopulatedRef.current.bottoms) setBottoms(data);
        })
        .catch((err) => console.error("[Bottoms] fetch error:", err)),
      garmentService
        .getBySlot(FittingSlot.FootGarment)
        .then((data) => {
          if (!aiPopulatedRef.current.shoes) setShoes(data);
        })
        .catch((err) => console.error("[Shoes] fetch error:", err)),
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
        .then((data) => {
          if (!aiPopulatedRef.current.bags) setBags(data);
        })
        .catch((err) => console.error("[Bag] fetch error:", err)),
    ]);

    outfitService
      .getAll()
      .then((data) => {
        if (!aiPopulatedRef.current.outfits) setOutfits(data);
      })
      .catch((err) => console.error("[Outfits] fetch error:", err));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <MirrorHeader />

      {/* AI Suggestion Banner */}
      <div className="px-4 pb-2 z-10" style={{ marginTop: "-8px" }} />

      <div className="flex flex-1" style={{ height: "546px" }}>
        {/* Left panel — Accessories */}
        <div
          className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
          style={{ flex: "0 0 25%", width: "25%" }}
        >
          <div className="flex flex-col gap-1">
            <SectionTitle label="Bags" />

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
                  gridTemplateRows: "repeat(2, 1fr)",
                  gap: "4px",
                }}
                className="glass-card"
              >
                {aiLoading || voiceLoading ? (
                  Array.from({ length: accessoryPageSize }).map((_, i) => (
                    <SkeletonCell
                      key={i}
                      style={{ marginTop: "5px", marginBottom: "5px" }}
                    />
                  ))
                ) : bags.length === 0 ? (
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
                    No recommended Bags
                  </div>
                ) : (
                  pagedBags.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => { if (swapSlot === "bags" && swapItemId) { applySwap(g); } else { setSelectedBag(g); setSelectedOutfitIdx(null); } }}
                      className="rounded-md overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: "1/1",
                        borderRadius: "4px",
                        marginTop: "5px",
                        marginBottom: "5px",
                        cursor: "pointer",
                        border:
                          selectedBag?.id === g.id
                            ? "1.5px solid rgba(255,255,255,0.6)"
                            : "1.5px solid transparent",
                      }}
                    >
                      {g.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.imageUrl}
                          alt={g.name}
                          draggable={false}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      )}
                    </div>
                  ))
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
          <div
            className="flex flex-col gap-1"
            style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          >
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
                {aiLoading || voiceLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCell
                      key={i}
                      style={{
                        borderRadius: "10px",
                        aspectRatio: "unset",
                        height: "100%",
                      }}
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
                    No recommended Outfits
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
                        .map((item) => {
                          const effective = outfitOverrides[item.id] ?? item.garment;
                          const isSwapping = swapItemId === item.id;
                          const isOverridden = !!outfitOverrides[item.id];
                          return (
                          <div
                            key={item.id}
                            className="flex"
                            onClick={() => {
                              const slot = resolveSwapSlot(item.garment.garmentType, item.garment.fittingSlot);
                              if (isSwapping) { cancelSwap(); return; }
                              setSwapSlot(slot);
                              setSwapItemId(item.id);
                            }}
                            style={{
                              flex: "1 1 0",
                              minHeight: 0,
                              width: "100%",
                              alignItems: "stretch",
                              overflow: "hidden",
                              background: "transparent",
                              cursor: "pointer",
                              border: isSwapping
                                ? "1.5px solid rgba(255,255,255,0.6)"
                                : isOverridden
                                ? "1.5px solid rgba(100,220,120,0.5)"
                                : "1.5px solid transparent",
                              borderRadius: "8px",
                              transition: "border-color 0.15s",
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
                              {effective.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={effective.imageUrl}
                                  alt={effective.name}
                                  draggable={false}
                                  className="w-full h-full object-contain pointer-events-none"
                                />
                              ) : (
                                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>
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
                              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.08em", overflow: "hidden", whiteSpace: "nowrap" }}>
                                {isOverridden ? "Changed" : effective.garmentType?.[0]}
                              </span>
                              <span style={{ color: "white", fontSize: "10px", fontWeight: 600, lineHeight: 1.3, overflow: "hidden" }}>
                                {effective.name}
                              </span>
                              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", lineHeight: 1.4, overflow: "hidden" }}>
                                {effective.description}
                              </span>
                            </div>
                          </div>
                          );
                        })}
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
                    selectedTopBase,
                    selectedTopMid,
                    selectedTopOuter,
                    selectedBag,
                    selectedBottom,
                    selectedShoe,
                  ]
                    .filter((g): g is RemoteGarment => g !== null)
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
                            {g.layerLevel ?? g.garmentType[0]}
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
          {/* Cancel swap mode */}
          {swapSlot && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "2px" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Select replacement
              </span>
              <button
                onClick={cancelSwap}
                style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Tops — Base layer */}
          {(aiLoading || voiceLoading || topsBase.length > 0) && (!swapSlot || swapSlot === "base") && (
            <div className="flex flex-col gap-1">
              <SectionTitle label="Base" />
              <div
                {...topsBaseSwipe}
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
                  {aiLoading || voiceLoading
                    ? Array.from({ length: topsLayerPageSize }).map((_, i) => (
                        <SkeletonCell key={i} />
                      ))
                    : pagedTopsBase.map((g, i) => (
                        <div
                          key={g?.id ?? i}
                          onClick={() => { if (!g) return; if (swapSlot === "base" && swapItemId) { applySwap(g); } else { setSelectedTopBase(g); setSelectedOutfitIdx(null); } }}
                          className="rounded-md overflow-hidden flex items-center justify-center"
                          style={{
                            aspectRatio: "1/1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            border:
                              selectedTopBase?.id === g.id
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
                      ))}
                </div>
                <div className="flex justify-center gap-1.5 pt-2">
                  {Array.from({ length: Math.max(1, totalTopsBasePages) }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === topsBasePage ? 12 : 4,
                          height: 4,
                          background:
                            i === topsBasePage
                              ? "white"
                              : "rgba(255,255,255,0.3)",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tops — Mid layer */}
          {(aiLoading || voiceLoading || topsMid.length > 0) && (!swapSlot || swapSlot === "mid") && (
            <div className="flex flex-col gap-1">
              <SectionTitle label="Mid" />
              <div
                {...topsMidSwipe}
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
                  {aiLoading || voiceLoading
                    ? Array.from({ length: topsLayerPageSize }).map((_, i) => (
                        <SkeletonCell key={i} />
                      ))
                    : pagedTopsMid.map((g, i) => (
                        <div
                          key={g?.id ?? i}
                          onClick={() => { if (!g) return; if (swapSlot === "mid" && swapItemId) { applySwap(g); } else { setSelectedTopMid(g); setSelectedOutfitIdx(null); } }}
                          className="rounded-md overflow-hidden flex items-center justify-center"
                          style={{
                            aspectRatio: "1/1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            border:
                              selectedTopMid?.id === g.id
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
                      ))}
                </div>
                <div className="flex justify-center gap-1.5 pt-2">
                  {Array.from({ length: Math.max(1, totalTopsMidPages) }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === topsMidPage ? 12 : 4,
                          height: 4,
                          background:
                            i === topsMidPage
                              ? "white"
                              : "rgba(255,255,255,0.3)",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tops — Outer layer */}
          {(aiLoading || voiceLoading || topsOuter.length > 0) && (!swapSlot || swapSlot === "outer") && (
            <div className="flex flex-col gap-1">
              <SectionTitle label="Outer" />
              <div
                {...topsOuterSwipe}
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
                  {aiLoading || voiceLoading
                    ? Array.from({ length: topsLayerPageSize }).map((_, i) => (
                        <SkeletonCell key={i} />
                      ))
                    : pagedTopsOuter.map((g, i) => (
                        <div
                          key={g?.id ?? i}
                          onClick={() => { if (!g) return; if (swapSlot === "outer" && swapItemId) { applySwap(g); } else { setSelectedTopOuter(g); setSelectedOutfitIdx(null); } }}
                          className="rounded-md overflow-hidden flex items-center justify-center"
                          style={{
                            aspectRatio: "1/1",
                            borderRadius: "4px",
                            cursor: "pointer",
                            border:
                              selectedTopOuter?.id === g.id
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
                      ))}
                </div>
                <div className="flex justify-center gap-1.5 pt-2">
                  {Array.from({ length: Math.max(1, totalTopsOuterPages) }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: i === topsOuterPage ? 12 : 4,
                          height: 4,
                          background:
                            i === topsOuterPage
                              ? "white"
                              : "rgba(255,255,255,0.3)",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {(!swapSlot || swapSlot === "bottoms") && (
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
                {aiLoading || voiceLoading ? (
                  Array.from({ length: pageSize }).map((_, i) => (
                    <SkeletonCell key={i} />
                  ))
                ) : bottoms.length === 0 ? (
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
                    No recommended Bottoms
                  </div>
                ) : (
                  pagedBottoms.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => { if (swapSlot === "bottoms" && swapItemId) { applySwap(g); } else { setSelectedBottom(g); setSelectedOutfitIdx(null); } }}
                      className="rounded-md overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: "1/1",
                        borderRadius: "4px",
                        cursor: "pointer",
                        border:
                          selectedBottom?.id === g.id
                            ? "1.5px solid rgba(255,255,255,0.6)"
                            : "1.5px solid transparent",
                      }}
                    >
                      {g.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.imageUrl}
                          alt={g.name}
                          draggable={false}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      )}
                    </div>
                  ))
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
          )}

          {(!swapSlot || swapSlot === "shoes") && (
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
                {aiLoading || voiceLoading ? (
                  Array.from({ length: shoesPageSize }).map((_, i) => (
                    <SkeletonCell key={i} />
                  ))
                ) : shoes.length === 0 ? (
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
                    No recommended Shoes
                  </div>
                ) : (
                  pagedShoes.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => { if (swapSlot === "shoes" && swapItemId) { applySwap(g); } else { setSelectedShoe(g); setSelectedOutfitIdx(null); } }}
                      className="rounded-md overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: "1/1",
                        borderRadius: "4px",
                        cursor: "pointer",
                        border:
                          selectedShoe?.id === g.id
                            ? "1.5px solid rgba(255,255,255,0.6)"
                            : "1.5px solid transparent",
                      }}
                    >
                      {g.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={g.imageUrl}
                          alt={g.name}
                          draggable={false}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      )}
                    </div>
                  ))
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
          )}
        </div>
      </div>

      {/* Create Outfit — fixed to viewport bottom center, hidden when outfit is selected (unless modified) */}
      {(selectedOutfitIdx === null || outfitModified) && (
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
          onClick={() => setShowConfirm(true)}
        >
          {outfitModified ? "Customize Outfit" : "Create Outfit"}
        </button>
      )}

      {/* Outfit preview modal */}
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
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{
              background: "#111",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "20px",
              padding: "24px 20px",
              width: "360px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                color: "white",
                fontSize: "20px",
                fontWeight: "700",
                textAlign: "center",
                margin: 0,
              }}
            >
              {outfitModified ? "Customized Look" : "Your Look"}
            </p>

            <div
              style={{
                width: "100%",
                aspectRatio: "2/3",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#1a1a1a",
              }}
            >
              {(() => {
                // When an outfit is selected (and possibly modified), derive
                // canvas garments from outfit items + overrides.
                // Otherwise fall back to individual slot selections.
                let cBase: RemoteGarment | null = selectedTopBase;
                let cMid:  RemoteGarment | null = selectedTopMid;
                let cOuter: RemoteGarment | null = selectedTopOuter;
                let cBottom: RemoteGarment | null = selectedBottom;
                let cShoe:   RemoteGarment | null = selectedShoe;
                let cBag:    RemoteGarment | null = selectedBag;

                const activeOutfit = selectedOutfitIdx !== null ? (outfits[selectedOutfitIdx] ?? null) : null;
                if (activeOutfit) {
                  cBase = null; cMid = null; cOuter = null;
                  cBottom = null; cShoe = null; cBag = null;
                  for (const item of activeOutfit.items) {
                    const eff = (outfitOverrides[item.id] ?? item.garment) as RemoteGarment;
                    if (eff.garmentType?.includes("Bag")) { cBag = eff; continue; }
                    if (item.slot === "LowerGarment") { cBottom = eff; continue; }
                    if (item.slot === "FootGarment")  { cShoe   = eff; continue; }
                    if (item.slot === "UpperGarment") {
                      const layer = resolveSwapSlot(eff.garmentType ?? [], eff.fittingSlot ?? []);
                      if (layer === "outer") cOuter = eff;
                      else if (layer === "mid") cMid = eff;
                      else cBase = eff;
                    }
                  }
                }

                return (
                  <OutfitPreviewCanvas
                    topBase={cBase}
                    topMid={cMid}
                    topOuter={cOuter}
                    bottom={cBottom}
                    shoe={cShoe}
                    bag={cBag}
                  />
                );
              })()}
            </div>

            <button
              style={{
                width: "100%",
                padding: "12px",
                background: "#ffffff",
                border: "none",
                borderRadius: "12px",
                color: "#000",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
              }}
              onClick={() => setShowConfirm(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <VoiceTranscribeOverlay onAiComplete={(r) => handleAiComplete(r)} onLoadingChange={setVoiceLoading} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
