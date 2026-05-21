"use client";

import { useEffect, useRef } from "react";
import { FittingSlot, type SlotMap } from "@/modules/garment/types";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";

// ── Canvas compositing helpers (mirrors save-outfit logic) ─────────────────

const SLOT_TO_PART: Record<FittingSlot, string> = {
  [FittingSlot.HeadGarment]:        "head",
  [FittingSlot.Glasses]:            "glasses",
  [FittingSlot.Earrings]:           "earrings",
  [FittingSlot.UpperGarment]:       "torso",
  [FittingSlot.LowerGarment]:       "legs",
  [FittingSlot.FullGarment]:        "full",
  [FittingSlot.FootGarment]:        "feet",
  [FittingSlot.RightHandAccessory]: "leftHand",
  [FittingSlot.LeftHandAccessory]:  "rightHand",
  [FittingSlot.NeckAccessory]:      "neck",
  [FittingSlot.WaistAccessory]:     "waist",
  [FittingSlot.None]:               "accessory",
};

const BODY_POSITIONS: Record<string, [number, number, number, number]> = {
  head:      [175,  -20, 150, 143],
  glasses:   [190,   90, 120,  48],
  earrings:  [ 80,   80, 180,  66],
  neck:      [210,  150,  90,  69],
  torso:     [100,  120, 306, 383],
  leftHand:  [120,  400,  72, 132],
  rightHand: [320,  400,  72, 132],
  waist:     [160,  390, 186,  63],
  legs:      [140,  360, 234, 370],
  feet:      [140,  680, 234,  87],
  full:      [  0,  138, 315, 630],
};

const GARMENT_SCALE: Record<string, number> = {
  head: 0.8, glasses: 0.6, earrings: 0.5, neck: 1.5,
  torso: 0.8, leftHand: 0.7, rightHand: 0.7, waist: 0.8,
  legs: 0.8, feet: 1.3, full: 1.0,
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

async function loadGarmentImage(src: string): Promise<HTMLImageElement> {
  if (!src.startsWith("http://") && !src.startsWith("https://")) return loadImage(src);
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
    if (res.ok) {
      const blobUrl = URL.createObjectURL(await res.blob());
      try { return await loadImage(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
    }
  } catch { /* fall through */ }
  return loadImage(src);
}

function getVisibleBounds(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  try {
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 8) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
    if (minX <= maxX) return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  } catch { /* tainted */ }
  return { x: 0, y: 0, width: c.width, height: c.height };
}

function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, tx: number, ty: number, tw: number, th: number) {
  const b = getVisibleBounds(img);
  const scale = Math.min(tw / b.width, th / b.height);
  const dw = b.width * scale, dh = b.height * scale;
  ctx.drawImage(img, b.x, b.y, b.width, b.height, tx + (tw - dw) / 2, ty + (th - dh) / 2, dw, dh);
}

async function drawOutfit(canvas: HTMLCanvasElement, slotMap: SlotMap, dpr = 1) {
  const W = 500, H = 780;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const filled = Object.values(slotMap).filter(s => s?.garment?.imageUrl);
  const loaded = await Promise.all(
    filled.map(async s => {
      try {
        const part = SLOT_TO_PART[s!.slot];
        const img  = await loadGarmentImage(s!.garment!.imageUrl);
        return { part, img };
      } catch { return null; }
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
    drawContained(ctx, item.img, x - (w * s - w) / 2, y - (h * s - h) / 2, w * s, h * s);
  });
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  hat:    RemoteGarment | null;
  top:    RemoteGarment | null;
  bottom: RemoteGarment | null;
  shoe:   RemoteGarment | null;
  bag:    RemoteGarment | null;
}

function toSlotMap({ hat, top, bottom, shoe, bag }: Props): SlotMap {
  const add = (slot: FittingSlot, g: RemoteGarment | null) =>
    g ? { [slot]: { slot, label: slot, garment: { id: g.id, name: g.name, imageUrl: g.imageUrl, slot } } } : {};
  return {
    ...add(FittingSlot.HeadGarment,        hat),
    ...add(FittingSlot.UpperGarment,       top),
    ...add(FittingSlot.LowerGarment,       bottom),
    ...add(FittingSlot.FootGarment,        shoe),
    ...add(FittingSlot.RightHandAccessory, bag),
  };
}

export default function OutfitPreviewCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const slotMap = toSlotMap(props);
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    drawOutfit(canvas, slotMap, dpr);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.hat?.id, props.top?.id, props.bottom?.id, props.shoe?.id, props.bag?.id]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f8f9fb", borderRadius: "12px" }}
    />
  );
}
