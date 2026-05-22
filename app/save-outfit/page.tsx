"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download } from "lucide-react";
import { FittingSlot, type SlotMap } from "@/modules/garment/types";


const SLOT_TO_PART: Record<FittingSlot, string> = {
  [FittingSlot.HeadGarment]:        "head",
  [FittingSlot.Glasses]:            "glasses",
  [FittingSlot.Earrings]:           "earrings",
  [FittingSlot.UpperGarment]:       "torso",
  [FittingSlot.LowerGarment]:       "legs",
  [FittingSlot.FullGarment]:        "full",
  [FittingSlot.FootGarment]:        "feet",
  [FittingSlot.RightHandAccessory]:  "leftHand",
  [FittingSlot.LeftHandAccessory]: "rightHand",
  [FittingSlot.NeckAccessory]:      "neck",
  [FittingSlot.WaistAccessory]:     "waist",
  [FittingSlot.None]:               "accessory",
};

const BODY_POSITIONS: Record<string, [number, number, number, number]> = {
  //      vertical   horizontal
  head:       [175,  -20, 150, 143],
  glasses:    [190,  90, 120,  48],
  earrings:   [80,  80, 180,  66],
  neck:       [210, 150,  90,  69],
  torso:      [100, 120, 306, 383],
  leftHand:   [120, 400,  72, 132],
  rightHand:  [320, 400,  72, 132],
  waist:      [160, 390, 186,  63],
  legs:       [140, 360, 234, 370],
  feet:       [140, 680, 234,  87],
  full:       [0, 138, 315, 630],
};

// Scale multiplier per part — 1.0 = fills the slot box exactly, >1 grows beyond it, <1 shrinks.
const GARMENT_SCALE: Record<string, number> = {
  head:       0.8,
  glasses:    0.6,
  earrings:   0.5,
  neck:       1.5,
  torso:      .8,
  leftHand:   0.7,
  rightHand:  0.7,
  waist:      .8,
  legs:       .8,
  feet:       1.3,
  full:       1.0,
};

const DRAW_ORDER = ["full", "torso", "legs", "feet", "head", "glasses", "earrings", "neck", "waist", "leftHand", "rightHand"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Try proxy first (keeps canvas clean for toDataURL), fall back to direct load.
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
  } catch { /* proxy failed — fall through */ }
  // Direct fallback (canvas will be tainted, Save may not work)
  return loadImage(src);
}

function getVisibleBounds(img: HTMLImageElement): { x: number; y: number; width: number; height: number } {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
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
  } catch {
    // Cross-origin tainted canvas — use full bounds
  }
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

// Draws directly onto the provided canvas element — never calls toDataURL,
// so CORS taint from fallback direct-loads doesn't prevent display.
// dpr scales the canvas to the screen's physical pixel density so output is crisp on HiDPI screens.
async function drawOutfit(
  canvas: HTMLCanvasElement,
  slotMap: SlotMap,
  dpr: number = 1,
): Promise<void> {
  const W = 500, H = 780;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const filledSlots = Object.values(slotMap).filter(s => s?.garment?.imageUrl);

  const loaded = await Promise.all(
    filledSlots.map(async (s) => {
      try {
        const part = SLOT_TO_PART[s!.slot];
        const img = await loadGarmentImage(s!.garment!.imageUrl);
        return { part, img };
      } catch {
        return null;
      }
    })
  );

  const items = loaded.filter(Boolean) as { part: string; img: HTMLImageElement }[];

  DRAW_ORDER.forEach(part => {
    const item = items.find(i => i.part === part);
    if (!item) return;
    const pos = BODY_POSITIONS[part];
    if (!pos) return;
    const [x, y, w, h] = pos;
    const s = GARMENT_SCALE[part] ?? 1;
    const sw = w * s, sh = h * s;
    drawContained(ctx, item.img, x - (sw - w) / 2, y - (sh - h) / 2, sw, sh);
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Phase = "building" | "done" | "error";

export default function TryItOnPage() {
  const router     = useRouter();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const hasStarted = useRef(false);
  const [phase,    setPhase]    = useState<Phase>("building");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generate();
     
  }, []);

  async function generate() {
    setPhase("building");
    setErrorMsg("");
    try {
      const raw = localStorage.getItem("mirror_outfit_slots");
      const slotMap: SlotMap = raw ? JSON.parse(raw) : {};

      const hasAny = Object.values(slotMap).some(s => s?.garment);
      if (!hasAny) {
        setErrorMsg("No garments selected. Go back and choose some clothes first.");
        setPhase("error");
        return;
      }

      // Canvas is always mounted (hidden), so canvasRef is always available
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not ready");

      await drawOutfit(canvas, slotMap, window.devicePixelRatio || 1);
      setPhase("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setPhase("error");
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "outfit.png";
      a.click();
    } catch {
      // Canvas tainted — can't export
    }
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">

      {/* ── Background gradient ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1030] via-[#0d0820] to-[#1a1030]" />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center gap-4 px-6 pt-10 pb-4 flex-none">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </motion.button>
        <span className="text-white font-semibold text-lg tracking-wide">Try It On</span>
      </header>

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0">

        {/* Canvas — always mounted so ref is available before phase turns "done" */}
        <div className={`flex flex-col items-center gap-6 w-full ${phase === "done" ? "" : "hidden"}`}>
          <div
            className="relative w-full rounded-3xl overflow-hidden shadow-[0_8px_64px_rgba(168,85,247,0.25)] border border-white/10"
            style={{ maxHeight: "65vh", aspectRatio: "2/3" }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain"
              style={{ background: "#fbfcff" }}
            />
          </div>
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

          {/* Loading / Building */}
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
