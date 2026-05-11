"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Crown, Glasses, Gem, Shirt, Layers, Package,
  Footprints, Watch, Link, CircleDot, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── preserved data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    group: "Head & Face",
    items: [
      { key: "HeadGarment",  label: "Head Garment", desc: "Hats, beanies, helmets" },
      { key: "Glasses",      label: "Glasses",       desc: "Spectacles, sunglasses" },
      { key: "Earrings",     label: "Earrings",      desc: "Ear accessories" },
    ],
  },
  {
    group: "Torso & Legs",
    items: [
      { key: "UpperGarment", label: "Upper Garment", desc: "Tops, shirts, jackets" },
      { key: "LowerGarment", label: "Lower Garment", desc: "Pants, skirts, shorts" },
      { key: "FullGarment",  label: "Full Garment",  desc: "Dresses, jumpsuits, overalls" },
    ],
  },
  {
    group: "Extremities",
    items: [
      { key: "FootGarment",  label: "Foot Garment",  desc: "Shoes, boots, sneakers" },
    ],
  },
  {
    group: "Accessories",
    items: [
      { key: "HandAccessory",  label: "Hand Accessory",  desc: "" },
      { key: "NeckAccessory",  label: "Neck Accessory",  desc: "Necklaces, ties, scarves" },
      { key: "WaistAccessory", label: "Waist Accessory", desc: "Belts, chains" },
    ],
  },
];

const CARD_GRADIENTS = [
  "from-purple-400 to-pink-400",
  "from-violet-400 to-purple-500",
  "from-fuchsia-400 to-pink-500",
];

// ── carousel items ─────────────────────────────────────────────────────────────

type CarouselItem = { key: string; label: string; desc: string; icon: LucideIcon };

const ICON_MAP: Record<string, LucideIcon> = {
  HeadGarment:    Crown,
  Glasses:        Glasses,
  Earrings:       Gem,
  UpperGarment:   Shirt,
  LowerGarment:   Layers,
  FullGarment:    Package,
  FootGarment:    Footprints,
  HandAccessory:  Watch,
  NeckAccessory:  Link,
  WaistAccessory: CircleDot,
};

const CAROUSEL_ITEMS: CarouselItem[] = CATEGORIES.flatMap(cat =>
  cat.items.map(item => ({ ...item, icon: ICON_MAP[item.key] ?? Package }))
);

// Placeholder product items — 3 per category slot
type ProductItem = { id: string; gradient: string };
const PRODUCT_ITEMS: ProductItem[] = CARD_GRADIENTS.map((gradient, i) => ({
  id: String(i),
  gradient,
}));

// ── CategoryItem (preserved) ───────────────────────────────────────────────────

function CategoryItem({ item, index }: { item: { key: string; label: string; desc: string }; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 * index }}
      className="rounded-2xl overflow-hidden border border-white/15 bg-white/5"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/10 transition-colors"
      >
        <div className="text-left">
          <p className="text-white font-semibold text-base leading-tight">{item.label}</p>
          {item.desc && <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-white/60 flex-shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="cards"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex gap-3 px-4 pb-4 pt-1 overflow-x-auto scrollbar-none">
              {CARD_GRADIENTS.map((gradient, i) => (
                <div key={i} className={`flex-shrink-0 w-28 h-36 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg flex flex-col justify-end p-3 cursor-pointer hover:scale-105 transition-transform`}>
                  <span className="text-white text-xs font-semibold drop-shadow">{item.label} {i + 1}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── generic arc carousel ───────────────────────────────────────────────────────

const ARC_FACTOR   = 6;
const SCALE_STEP   = 0.13;
const OPACITY_STEP = 0.30;
const MAX_OFFSET   = 3;
const SLOT_PX      = 96;
const ICON_BASE_PX = 80;

function ArcCarousel<T extends object>({
  items,
  renderIcon,
  onSelect,
  resetKey,
  iconBasePx = ICON_BASE_PX,
  slotPx = SLOT_PX,
}: {
  items: T[];
  renderIcon: (item: T, active: boolean) => React.ReactNode;
  onSelect?: (item: T) => void;
  resetKey?: React.Key;
  iconBasePx?: number;
  slotPx?: number;
}) {
  const n           = items.length;
  const wrapItem    = (vi: number): T => items[((vi % n) + n) % n];

  const [centerVI, setCenterVI] = useState(0);
  const [dragPx,   setDragPx]   = useState(0);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX     = useRef(0);

  useEffect(() => {
    isDragging.current = false;
    setCenterVI(0);
    setDragPx(0);
  }, [resetKey]);

  const effectiveVI = centerVI - dragPx / slotPx;
  const lo  = Math.floor(effectiveVI) - MAX_OFFSET - 1;
  const hi  = Math.ceil(effectiveVI)  + MAX_OFFSET + 1;
  const vis = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) hasDragged.current = true;
    setDragPx(dx);
  };

  const commit = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const snapped = Math.round(effectiveVI);
    setCenterVI(snapped);
    setDragPx(0);
    onSelect?.(wrapItem(snapped));
  };

  return (
    <div
      className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none w-full"
      style={{ height: iconBasePx + MAX_OFFSET * MAX_OFFSET * ARC_FACTOR + 16, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={commit}
      onPointerLeave={commit}
    >
      {vis.map(vi => {
        const offset    = vi - effectiveVI;
        const absOffset = Math.abs(offset);
        if (absOffset > MAX_OFFSET + 0.6) return null;

        const item    = wrapItem(vi);
        const active  = absOffset < 0.5;
        const x       = offset * slotPx;
        const y       = absOffset * absOffset * ARC_FACTOR;
        const scale   = Math.max(0.45, 1 - absOffset * SCALE_STEP);
        const opacity = Math.max(0,    1 - absOffset * OPACITY_STEP);

        return (
          <motion.button
            key={vi}
            className="absolute focus:outline-none flex items-start justify-center"
            style={{ top: 0, left: "50%", width: iconBasePx, marginLeft: -iconBasePx / 2 }}
            animate={{ x, y, scale, opacity }}
            transition={
              isDragging.current
                ? { duration: 0 }
                : { type: "spring", stiffness: 380, damping: 30, mass: 0.8 }
            }
            onClick={() => {
              if (!hasDragged.current) {
                setCenterVI(vi);
                onSelect?.(item);
              }
            }}
          >
            {renderIcon(item, active)}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

export default function CapturePicturePage() {
  const [photo, setPhoto]                 = useState<string | null>(null);
  const [selectedCategory, setCategory]   = useState<CarouselItem>(CAROUSEL_ITEMS[0]);

  useEffect(() => {
    const stored = localStorage.getItem("mirror_captured_photo");
    if (stored) setPhoto(stored);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">

      {/* Background photo */}
      <AnimatePresence>
        {photo ? (
          <motion.img
            key="photo"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 160, damping: 20 }}
            src={photo}
            alt="Your captured photo"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca]"
          >
            <p className="text-[#6b5b95] text-2xl">No photo found. Go back and strike a pose! ✌️</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col">

        {/* ── Items carousel — resets when category changes ── */}
        <ArcCarousel<ProductItem>
          items={PRODUCT_ITEMS}
          resetKey={selectedCategory.key}
          iconBasePx={128}
          slotPx={136}
          renderIcon={(item, active) => (
            <div
              className={`rounded-full bg-white flex items-center justify-center transition-all duration-150 ${
                active
                  ? "w-32 h-32 shadow-[0_6px_36px_rgba(255,255,255,0.55)]"
                  : "w-24 h-24 opacity-70"
              }`}
            >
              <div
                className={`rounded-full bg-gradient-to-br ${item.gradient} transition-all duration-150 ${
                  active ? "w-24 h-24" : "w-[72px] h-[72px]"
                }`}
              />
            </div>
          )}
        />

        {/* ── Category carousel ── */}
        <ArcCarousel<CarouselItem>
          items={CAROUSEL_ITEMS}
          onSelect={setCategory}
          renderIcon={(item, active) => (
            <div
              className={`rounded-full flex items-center justify-center transition-all duration-150 ${
                active
                  ? "w-20 h-20 bg-white shadow-[0_4px_28px_rgba(255,255,255,0.50)]"
                  : "w-16 h-16 bg-white/20"
              }`}
            >
              <item.icon
                className={`transition-colors duration-150 ${
                  active ? "w-10 h-10 text-purple-600" : "w-8 h-8 text-white/75"
                }`}
              />
            </div>
          )}
        />

      </div>
    </main>
  );
}
