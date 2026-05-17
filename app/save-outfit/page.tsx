"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download, Eye, EyeOff, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { FittingSlot, type SlotMap } from "@/modules/garment/types";


const SLOT_TO_PART: Record<FittingSlot, string> = {
  [FittingSlot.HeadGarment]:         "head",
  [FittingSlot.Glasses]:             "glasses",
  [FittingSlot.Earrings]:            "earrings",
  [FittingSlot.UpperGarment]:        "torso",
  [FittingSlot.LowerGarment]:        "legs",
  [FittingSlot.FullGarment]:         "full",
  [FittingSlot.FootGarment]:         "feet",
  [FittingSlot.RightHandAccessory]:  "leftHand",
  [FittingSlot.LeftHandAccessory]:   "rightHand",
  [FittingSlot.NeckAccessory]:       "neck",
  [FittingSlot.WaistAccessory]:      "waist",
  [FittingSlot.None]:                "accessory",
};

const BODY_POSITIONS: Record<string, [number, number, number, number]> = {
  //      x      y    w    h
  head:       [175,  -20, 150, 143],
  glasses:    [190,   90, 120,  48],
  earrings:   [ 80,   80, 180,  66],
  neck:       [210,  150,  90,  69],
  torso:      [100,  120, 306, 383],
  leftHand:   [120,  400,  72, 132],
  rightHand:  [320,  400,  72, 132],
  waist:      [160,  390, 186,  63],
  legs:       [140,  360, 234, 370],
  feet:       [140,  680, 234,  87],
  full:       [  0,  138, 315, 630],
};

const GARMENT_SCALE: Record<string, number> = {
  head:      0.8,
  glasses:   0.6,
  earrings:  0.5,
  neck:      1.5,
  torso:     0.8,
  leftHand:  0.7,
  rightHand: 0.7,
  waist:     0.8,
  legs:      0.8,
  feet:      1.3,
  full:      1.0,
};

const DRAW_ORDER = ["full", "torso", "legs", "feet", "head", "glasses", "earrings", "neck", "waist", "leftHand", "rightHand"];

const PART_LABELS: Record<string, string> = {
  head:      "Head",
  glasses:   "Glasses",
  earrings:  "Earrings",
  neck:      "Neck",
  torso:     "Top",
  leftHand:  "Left Hand",
  rightHand: "Right Hand",
  waist:     "Waist",
  legs:      "Bottom",
  feet:      "Shoes",
  full:      "Full Body",
};

// ── Image utilities ───────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadGarmentImage(src: string): Promise<HTMLImageElement> {
  if (!src.startsWith("http://") && !src.startsWith("https://")) {
    return loadImage(src);
  }
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
    if (res.ok) {
      const blobUrl = URL.createObjectURL(await res.blob());
      try { return await loadImage(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
    }
  } catch { /* fall through */ }
  return loadImage(src);
}

function getVisibleBounds(img: HTMLImageElement): { x: number; y: number; width: number; height: number } {
  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  try {
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    if (minX <= maxX) return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  } catch { /* tainted canvas — use full bounds */ }
  return { x: 0, y: 0, width: canvas.width, height: canvas.height };
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  tx: number, ty: number, tw: number, th: number,
) {
  const b = getVisibleBounds(img);
  const scale = Math.min(tw / b.width, th / b.height);
  const dw = b.width * scale;
  const dh = b.height * scale;
  ctx.drawImage(img, b.x, b.y, b.width, b.height, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GarmentLayer {
  id: string;
  part: string;
  imageUrl: string;
  img: HTMLImageElement;
  x: number;        // center-x in 500×780 logical space
  y: number;        // center-y in 500×780 logical space
  width: number;
  height: number;
  rotation: number; // degrees
  zIndex: number;
  visible: boolean;
}

type ActiveHandle =
  | { type: "move" }
  | { type: "rotate" }
  | { type: "resize"; corner: "tl" | "tr" | "bl" | "br" };

interface PointerSession {
  layerId: string;
  handle: ActiveHandle;
  startPointerX: number;
  startPointerY: number;
  startLayerX: number;
  startLayerY: number;
  startWidth: number;
  startHeight: number;
  startRotation: number;
  startAngleOffset: number;
}

// ── Layer initialization ──────────────────────────────────────────────────────

async function initLayers(slotMap: SlotMap): Promise<GarmentLayer[]> {
  const filledSlots = Object.values(slotMap).filter(s => s?.garment?.imageUrl);

  const loaded = await Promise.all(
    filledSlots.map(async (s) => {
      const part = SLOT_TO_PART[s!.slot];
      const pos  = BODY_POSITIONS[part];
      if (!pos) return null;
      try {
        const img = await loadGarmentImage(s!.garment!.imageUrl);
        const [bx, by, bw, bh] = pos;
        const scale = GARMENT_SCALE[part] ?? 1;
        const sw  = bw * scale;
        const sh  = bh * scale;
        // Replicates the drawContained offset in the old drawOutfit
        const tlx = bx - (sw - bw) / 2;
        const tly = by - (sh - bh) / 2;
        return {
          id:       String(s!.slot),
          part,
          imageUrl: s!.garment!.imageUrl,
          img,
          x:        tlx + sw / 2,
          y:        tly + sh / 2,
          width:    sw,
          height:   sh,
          rotation: 0,
          zIndex:   DRAW_ORDER.indexOf(part),
          visible:  true,
        } satisfies GarmentLayer;
      } catch {
        return null;
      }
    })
  );

  return loaded.filter(Boolean) as GarmentLayer[];
}

// ── GarmentLayerElement ───────────────────────────────────────────────────────

const HANDLE = 20;
const ROT_OFFSET = 36; // px above the layer top to the handle center

function GarmentLayerElement({
  layer,
  isSelected,
  onHandlePointerDown,
}: {
  layer: GarmentLayer;
  isSelected: boolean;
  onHandlePointerDown: (e: React.PointerEvent, layerId: string, handle: ActiveHandle) => void;
}) {
  return (
    <div
      data-layer-id={layer.id}
      style={{
        position:        "absolute",
        left:            layer.x - layer.width  / 2,
        top:             layer.y - layer.height / 2,
        width:           layer.width,
        height:          layer.height,
        transform:       `rotate(${layer.rotation}deg)`,
        transformOrigin: "center center",
        zIndex:          layer.zIndex,
        cursor:          isSelected ? "move" : "pointer",
        touchAction:     "none",
        opacity:         layer.visible ? 1 : 0,
        pointerEvents:   layer.visible ? undefined : "none",
      }}
    >
      <img
        src={layer.imageUrl}
        alt={layer.part}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {isSelected && (
        <>
          {/* Selection border */}
          <div style={{
            position: "absolute", inset: 0,
            border: "2px solid #8b7fc7",
            borderRadius: 4,
            pointerEvents: "none",
          }} />

          {/* Corner resize handles */}
          {(["tl", "tr", "bl", "br"] as const).map(corner => (
            <div
              key={corner}
              onPointerDown={e => {
                e.stopPropagation();
                onHandlePointerDown(e, layer.id, { type: "resize", corner });
              }}
              style={{
                position:    "absolute",
                width:       HANDLE,
                height:      HANDLE,
                background:  "white",
                border:      "2px solid #8b7fc7",
                borderRadius:"50%",
                cursor:      corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize",
                top:         corner[0] === "t" ? -HANDLE / 2 : undefined,
                bottom:      corner[0] === "b" ? -HANDLE / 2 : undefined,
                left:        corner[1] === "l" ? -HANDLE / 2 : undefined,
                right:       corner[1] === "r" ? -HANDLE / 2 : undefined,
                touchAction: "none",
                zIndex:      10,
              }}
            />
          ))}

          {/* Rotation connector line */}
          <div style={{
            position:      "absolute",
            width:         2,
            height:        ROT_OFFSET - HANDLE / 2,
            background:    "#8b7fc7",
            left:          "50%",
            top:           -(ROT_OFFSET - HANDLE / 2),
            transform:     "translateX(-50%)",
            pointerEvents: "none",
          }} />

          {/* Rotation handle */}
          <div
            onPointerDown={e => {
              e.stopPropagation();
              onHandlePointerDown(e, layer.id, { type: "rotate" });
            }}
            style={{
              position:    "absolute",
              width:       HANDLE,
              height:      HANDLE,
              background:  "#8b7fc7",
              borderRadius:"50%",
              cursor:      "grab",
              left:        "50%",
              top:         -(ROT_OFFSET + HANDLE / 2),
              transform:   "translateX(-50%)",
              touchAction: "none",
              zIndex:      10,
            }}
          />
        </>
      )}
    </div>
  );
}

// ── LayersPanel ───────────────────────────────────────────────────────────────

function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  layers: GarmentLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Highest z-index first (top of stack = leftmost in strip)
  const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);
  const selected = layers.find(l => l.id === selectedId) ?? null;

  return (
    <div className="w-full flex flex-col gap-2">

      {/* Action bar — shown only when a layer is selected */}
      <div
        className="flex items-center justify-between px-1 h-12"
        style={{ visibility: selected ? "visible" : "hidden" }}
      >
        <span className="text-white/80 text-base font-semibold">
          {selected ? (PART_LABELS[selected.part] ?? selected.part) : ""}
        </span>
        {selected && (
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onToggleVisibility(selected.id)}
              className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
              title={selected.visible ? "Hide" : "Show"}
            >
              {selected.visible
                ? <Eye className="w-5 h-5 text-white/70" />
                : <EyeOff className="w-5 h-5 text-white/40" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onMoveUp(selected.id)}
              className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
              title="Move up"
            >
              <ChevronUp className="w-5 h-5 text-white/70" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onMoveDown(selected.id)}
              className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"
              title="Move down"
            >
              <ChevronDown className="w-5 h-5 text-white/70" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onDelete(selected.id)}
              className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
            </motion.button>
          </div>
        )}
      </div>

      {/* Horizontal layer thumbnail strip */}
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {sorted.map(layer => (
          <motion.button
            key={layer.id}
            whileTap={{ scale: 0.93 }}
            onClick={() => onSelect(layer.id)}
            className="flex-none flex flex-col items-center gap-1.5"
          >
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 bg-white/10 flex items-center justify-center transition-all"
              style={{
                borderColor: layer.id === selectedId ? "#8b7fc7" : "rgba(255,255,255,0.15)",
                opacity:     layer.visible ? 1 : 0.35,
              }}
            >
              <img
                src={layer.imageUrl}
                alt={layer.part}
                draggable={false}
                className="w-full h-full object-contain"
                style={{ background: "white" }}
              />
            </div>
            <span
              className="text-sm leading-none"
              style={{ color: layer.id === selectedId ? "#a78bfa" : "rgba(255,255,255,0.5)" }}
            >
              {PART_LABELS[layer.part] ?? layer.part}
            </span>
          </motion.button>
        ))}
      </div>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Phase = "building" | "done" | "error";

export default function SaveOutfitPage() {
  const router     = useRouter();
  const hasStarted = useRef(false);
  const [phase,    setPhase]    = useState<Phase>("building");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [layers,       setLayers]       = useState<GarmentLayer[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [surfaceScale, setSurfaceScale] = useState(1);

  const sessionRef          = useRef<PointerSession | null>(null);
  const surfaceRef          = useRef<HTMLDivElement>(null);
  const pointerContainerRef = useRef<HTMLDivElement>(null);
  const exportCanvasRef     = useRef<HTMLCanvasElement>(null);

  // Compute CSS scale so the 500×780 surface fits the available viewport area
  useEffect(() => {
    function compute() {
      const vw     = window.innerWidth;
      const vh     = window.innerHeight;
      const maxH   = vh * 0.65;
      const maxW   = vw - 48; // px-6 padding both sides
      // The outer frame respects aspectRatio 2/3 and maxHeight
      const frameW = Math.min(maxW, maxH * (2 / 3));
      const frameH = Math.min(maxH, frameW * (3 / 2));
      setSurfaceScale(Math.min(frameW / 500, frameH / 780));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setPhase("building");
    setErrorMsg("");
    try {
      const raw     = localStorage.getItem("mirror_outfit_slots");
      const slotMap: SlotMap = raw ? JSON.parse(raw) : {};

      const hasAny = Object.values(slotMap).some(s => s?.garment);
      if (!hasAny) {
        setErrorMsg("No garments selected. Go back and choose some clothes first.");
        setPhase("error");
        return;
      }

      const ls = await initLayers(slotMap);
      setLayers(ls);
      setPhase("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setPhase("error");
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function bringToFront(layerId: string) {
    setLayers(prev => {
      const maxZ = Math.max(...prev.map(l => l.zIndex));
      return prev.map(l => l.id === layerId ? { ...l, zIndex: maxZ + 1 } : l);
    });
  }

  function toggleVisibility(layerId: string) {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  }

  function deleteLayer(layerId: string) {
    setLayers(prev => prev.filter(l => l.id !== layerId));
    if (selectedId === layerId) setSelectedId(null);
  }

  function moveLayerUp(layerId: string) {
    setLayers(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex(l => l.id === layerId);
      if (idx >= sorted.length - 1) return prev;
      const above = sorted[idx + 1];
      return prev.map(l => {
        if (l.id === layerId) return { ...l, zIndex: above.zIndex };
        if (l.id === above.id) return { ...l, zIndex: sorted[idx].zIndex };
        return l;
      });
    });
  }

  function moveLayerDown(layerId: string) {
    setLayers(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex(l => l.id === layerId);
      if (idx <= 0) return prev;
      const below = sorted[idx - 1];
      return prev.map(l => {
        if (l.id === layerId) return { ...l, zIndex: below.zIndex };
        if (l.id === below.id) return { ...l, zIndex: sorted[idx].zIndex };
        return l;
      });
    });
  }

  function toLogical(clientX: number, clientY: number) {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return {
      lx: (clientX - rect.left) * (500 / rect.width),
      ly: (clientY - rect.top)  * (780 / rect.height),
    };
  }

  // ── Pointer handlers ───────────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const layerEl = (e.target as HTMLElement).closest<HTMLElement>("[data-layer-id]");

    if (!layerEl) {
      setSelectedId(null);
      return;
    }

    const layerId = layerEl.dataset.layerId!;
    const layer   = layers.find(l => l.id === layerId);
    if (!layer) return;

    bringToFront(layerId);
    setSelectedId(layerId);
    e.currentTarget.setPointerCapture(e.pointerId);

    sessionRef.current = {
      layerId,
      handle:          { type: "move" },
      startPointerX:   e.clientX,
      startPointerY:   e.clientY,
      startLayerX:     layer.x,
      startLayerY:     layer.y,
      startWidth:      layer.width,
      startHeight:     layer.height,
      startRotation:   layer.rotation,
      startAngleOffset: 0,
    };
  }

  function handleHandlePointerDown(
    e: React.PointerEvent,
    layerId: string,
    handle: ActiveHandle,
  ) {
    e.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    pointerContainerRef.current?.setPointerCapture(e.pointerId);

    let startAngleOffset = 0;
    if (handle.type === "rotate") {
      const { lx, ly } = toLogical(e.clientX, e.clientY);
      const angle = Math.atan2(ly - layer.y, lx - layer.x) * (180 / Math.PI);
      startAngleOffset = layer.rotation - angle;
    }

    sessionRef.current = {
      layerId,
      handle,
      startPointerX:    e.clientX,
      startPointerY:    e.clientY,
      startLayerX:      layer.x,
      startLayerY:      layer.y,
      startWidth:       layer.width,
      startHeight:      layer.height,
      startRotation:    layer.rotation,
      startAngleOffset,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const sess = sessionRef.current;
    if (!sess) return;

    const { lx: curLx, ly: curLy }     = toLogical(e.clientX, e.clientY);
    const { lx: startLx, ly: startLy } = toLogical(sess.startPointerX, sess.startPointerY);
    const dlx = curLx - startLx;
    const dly = curLy - startLy;

    setLayers(prev => prev.map(layer => {
      if (layer.id !== sess.layerId) return layer;

      switch (sess.handle.type) {
        case "move":
          return { ...layer, x: sess.startLayerX + dlx, y: sess.startLayerY + dly };

        case "rotate": {
          const angle = Math.atan2(curLy - layer.y, curLx - layer.x) * (180 / Math.PI);
          return { ...layer, rotation: angle + sess.startAngleOffset };
        }

        case "resize": {
          const rad    = layer.rotation * (Math.PI / 180);
          const cos    = Math.cos(rad);
          const sin    = Math.sin(rad);
          const corner = sess.handle.corner;

          // Project the screen-space delta onto the layer's local axes
          const localDx =  dlx * cos + dly * sin;
          const localDy = -dlx * sin + dly * cos;

          const signX = corner[1] === "r" ? 1 : -1;
          const signY = corner[0] === "b" ? 1 : -1;

          // *2 because we resize from center (both edges move)
          const dw = localDx * signX * 2;
          const dh = localDy * signY * 2;

          // Lock aspect ratio using the dominant axis
          const aspect = sess.startWidth / sess.startHeight;
          let newW = sess.startWidth  + dw;
          let newH = sess.startHeight + dh;
          if (Math.abs(dw) >= Math.abs(dh)) {
            newH = newW / aspect;
          } else {
            newW = newH * aspect;
          }

          const MIN = 30;
          newW = Math.max(MIN, newW);
          newH = Math.max(MIN, newH);

          return { ...layer, width: newW, height: newH };
        }
      }
    }));
  }

  function handlePointerUp() {
    sessionRef.current = null;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function handleDownload() {
    const canvas = exportCanvasRef.current;
    if (!canvas) return;

    const W = 500, H = 780;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fbfcff";
    ctx.fillRect(0, 0, W, H);

    const sorted = [...layers].filter(l => l.visible).sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of sorted) {
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate(layer.rotation * (Math.PI / 180));
      drawContained(ctx, layer.img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      ctx.restore();
    }

    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "outfit.png";
      a.click();
    } catch { /* canvas tainted — skip */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1030] via-[#0d0820] to-[#1a1030]" />

      {/* Header */}
      <header className="relative z-10 flex items-center gap-4 px-6 pt-10 pb-4 flex-none">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </motion.button>
        <span className="text-white font-semibold text-lg tracking-wide">Edit Outfit</span>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0">

        {/* Interactive canvas — always in DOM, hidden until done */}
        <div className={`flex flex-col items-center gap-3 w-full ${phase === "done" ? "" : "hidden"}`}>

          {/* Outer frame */}
          <div
            className="relative w-full rounded-3xl overflow-hidden shadow-[0_8px_64px_rgba(168,85,247,0.25)] border border-white/10"
            style={{ maxHeight: "65vh", aspectRatio: "2/3", background: "#fbfcff" }}
          >
            {/* Pointer event surface */}
            <div
              ref={pointerContainerRef}
              className="absolute inset-0 overflow-hidden"
              style={{ touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* 500×780 logical canvas, CSS-scaled to fit */}
              <div
                ref={surfaceRef}
                className="absolute bg-[#fbfcff] select-none"
                style={{
                  width:           500,
                  height:          780,
                  top:             "50%",
                  left:            "50%",
                  transform:       `translate(-50%, -50%) scale(${surfaceScale})`,
                  transformOrigin: "center center",
                }}
              >
                {[...layers]
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map(layer => (
                    <GarmentLayerElement
                      key={layer.id}
                      layer={layer}
                      isSelected={layer.id === selectedId}
                      onHandlePointerDown={handleHandlePointerDown}
                    />
                  ))}
              </div>
            </div>
          </div>

          {/* Hidden canvas used only for PNG export */}
          <canvas ref={exportCanvasRef} className="hidden" />

          <LayersPanel
            layers={layers}
            selectedId={selectedId}
            onSelect={(id) => { bringToFront(id); setSelectedId(id); }}
            onToggleVisibility={toggleVisibility}
            onMoveUp={moveLayerUp}
            onMoveDown={moveLayerDown}
            onDelete={deleteLayer}
          />

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            className="w-full py-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur text-white font-semibold text-base flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save
          </motion.button>
        </div>

        <AnimatePresence mode="wait">

          {/* Loading */}
          {phase === "building" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 border-r-pink-400 animate-spin" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
                  <span className="text-2xl">✨</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-white font-semibold text-xl">Building your outfit…</span>
                <span className="text-white/40 text-sm">Loading garment images</span>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 text-center w-full"
            >
              <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-400/30 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-white font-semibold text-lg">Something went wrong</span>
                <span className="text-white/50 text-sm px-4 leading-relaxed">{errorMsg}</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { hasStarted.current = false; generate(); hasStarted.current = true; }}
                className="px-10 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base"
              >
                Try Again
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
