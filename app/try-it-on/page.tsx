"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, RefreshCw, Download } from "lucide-react";
import { FittingSlot, type SlotMap } from "@/modules/garment/types";

// Canvas: 500 × 780 px (same as mirror-admin)
const W = 500;
const H = 780;

const SLOT_TO_PART: Record<FittingSlot, string> = {
  [FittingSlot.HeadGarment]:        "head",
  [FittingSlot.Glasses]:            "glasses",
  [FittingSlot.Earrings]:           "earrings",
  [FittingSlot.UpperGarment]:       "torso",
  [FittingSlot.LowerGarment]:       "legs",
  [FittingSlot.FullGarment]:        "full",
  [FittingSlot.FootGarment]:        "feet",
  [FittingSlot.LeftHandAccessory]:  "leftHand",
  [FittingSlot.RightHandAccessory]: "rightHand",
  [FittingSlot.NeckAccessory]:      "neck",
  [FittingSlot.WaistAccessory]:     "waist",
  [FittingSlot.None]:               "accessory",
};

const BODY_POSITIONS: Record<string, [number, number, number, number]> = {
  head:       [200,  10, 100,  95],
  glasses:    [210,  56,  80,  32],
  earrings:   [190,  62, 120,  44],
  torso:      [148, 138, 204, 255],
  legs:       [172, 390, 156, 300],
  full:       [145, 138, 210, 558],
  feet:       [172, 668, 156,  58],
  leftHand:   [182, 368,  48,  88],
  rightHand:  [270, 368,  48,  88],
  neck:       [220, 103,  60,  46],
  waist:      [188, 378, 124,  42],
};

const DRAW_ORDER = ["full", "torso", "legs", "feet", "head", "glasses", "earrings", "neck", "waist", "leftHand", "rightHand"];

function proxied(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return `/api/proxy-image?url=${encodeURIComponent(src)}`;
  }
  return src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = proxied(src);
  });
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

async function buildReferenceImage(
  slotMap: SlotMap,
  outlineImg: HTMLImageElement,
): Promise<{ dataUrl: string; outfitItems: { part: string; name: string }[] }> {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw mannequin outline
  ctx.drawImage(outlineImg, (-400 / W) * canvas.width, (8 / H) * canvas.height, (1300 / W) * canvas.width, (750 / H) * canvas.height);

  const scaleX = canvas.width / W;
  const scaleY = canvas.height / H;

  // Collect filled garment slots
  const filledSlots = Object.values(slotMap).filter(s => s?.garment?.imageUrl);

  // Load all garment images in parallel
  const loaded = await Promise.all(
    filledSlots.map(async (s) => {
      try {
        const img = await loadImage(s!.garment!.imageUrl);
        return { part: SLOT_TO_PART[s!.slot], name: s!.garment!.name, img };
      } catch {
        return null;
      }
    })
  );

  const validItems = loaded.filter(Boolean) as { part: string; name: string; img: HTMLImageElement }[];

  // Draw in correct layering order
  DRAW_ORDER.forEach(part => {
    const item = validItems.find(i => i.part === part);
    if (!item) return;
    const pos = BODY_POSITIONS[part];
    if (!pos) return;
    const [x, y, w, h] = pos;
    drawContained(ctx, item.img, x * scaleX, y * scaleY, w * scaleX, h * scaleY);
  });

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    outfitItems: validItems.map(i => ({ part: i.part, name: i.name })),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Phase = "building" | "generating" | "done" | "error";

export default function TryItOnPage() {
  const router = useRouter();
  const [phase, setPhase]         = useState<Phase>("building");
  const [result, setResult]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string>("");
  const [elapsed, setElapsed]     = useState(0);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStarted                = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setPhase("building");
    setResult(null);
    setErrorMsg("");
    setElapsed(0);

    try {
      // Read slotMap from localStorage
      const raw = localStorage.getItem("mirror_outfit_slots");
      const slotMap: SlotMap = raw ? JSON.parse(raw) : {};

      const hasAny = Object.values(slotMap).some(s => s?.garment);
      if (!hasAny) {
        setErrorMsg("No garments selected. Go back and choose some clothes first.");
        setPhase("error");
        return;
      }

      // Load human outline
      const outlineImg = await loadImage("/human-outline.png");

      // Build reference image
      const { dataUrl, outfitItems } = await buildReferenceImage(slotMap, outlineImg);

      if (outfitItems.length === 0) {
        setErrorMsg("Could not load garment images. Please try again.");
        setPhase("error");
        return;
      }

      setPhase("generating");
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

      const res = await fetch("/api/generate-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImage: dataUrl, outfit: outfitItems }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");

      setResult(json.image);
      setPhase("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setPhase("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  function handleRetry() {
    hasStarted.current = false;
    generate();
    hasStarted.current = true;
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "outfit.png";
    a.click();
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
        <AnimatePresence mode="wait">

          {/* Loading / Building */}
          {(phase === "building" || phase === "generating") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-8 w-full"
            >
              {/* Animated spinner ring */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-400 border-r-pink-400 animate-spin" />
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
                  <span className="text-2xl">✨</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-white font-semibold text-xl">
                  {phase === "building" ? "Preparing outfit…" : "Generating your look…"}
                </span>
                <span className="text-white/40 text-sm">
                  {phase === "generating"
                    ? `This takes about 30–60 seconds · ${elapsed}s`
                    : "Loading garment images"}
                </span>
              </div>

              {phase === "generating" && (
                <div className="w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.min((elapsed / 55) * 100, 95)}%` }}
                    transition={{ ease: "linear", duration: 1 }}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Result */}
          {phase === "done" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-6 w-full"
            >
              <div className="relative w-full rounded-3xl overflow-hidden shadow-[0_8px_64px_rgba(168,85,247,0.25)] border border-white/10"
                style={{ maxHeight: "65vh", aspectRatio: "2/3" }}
              >
                <img
                  src={result}
                  alt="Your generated outfit"
                  className="w-full h-full object-contain bg-white"
                />
              </div>

              <div className="flex gap-3 w-full">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownload}
                  className="flex-1 py-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur text-white font-semibold text-base flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Save
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRetry}
                  className="flex-1 py-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur text-white font-semibold text-base flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </motion.button>
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
                onClick={handleRetry}
                className="px-10 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}
