"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  Crown, Glasses, Gem, Shirt, Layers,
  Footprints, Watch, Link, CircleDot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/modules/shared/utils";
import { FittingSlot, type GarmentSlot, type SlotMap } from "../types";

// ── Icons ──────────────────────────────────────────────────────────────────────

const SLOT_ICONS: Partial<Record<FittingSlot, LucideIcon>> = {
  [FittingSlot.HeadGarment]:        Crown,
  [FittingSlot.Glasses]:            Glasses,
  [FittingSlot.Earrings]:           Gem,
  [FittingSlot.UpperGarment]:       Shirt,
  [FittingSlot.LowerGarment]:       Layers,
  [FittingSlot.FootGarment]:        Footprints,
  [FittingSlot.LeftHandAccessory]:  Watch,
  [FittingSlot.RightHandAccessory]: Watch,
  [FittingSlot.NeckAccessory]:      Link,
  [FittingSlot.WaistAccessory]:     CircleDot,
};

// ── Hotspot sizes ──────────────────────────────────────────────────────────────

type HotspotSize = "lg" | "md" | "sm";

const SIZE: Record<HotspotSize, { button: string; icon: string; label: string }> = {
  lg: { button: "w-20 h-20", icon: "w-8 h-8",   label: "text-[11px]" },
  md: { button: "w-14 h-14", icon: "w-6 h-6",   label: "text-[10px]" },
  sm: { button: "w-10 h-10", icon: "w-[18px] h-[18px]", label: "text-[9px]" },
};

// ── Hotspot positions ──────────────────────────────────────────────────────────
// top/left are % of the mirror-main container (768 × ~942px)
// The SVG silhouette is centered and ~42% of container width

type HotspotDef =
  | { kind: "slot"; slot: FittingSlot; top: string; left: string; size: HotspotSize; label: string }
  | { kind: "earring"; side: "left" | "right"; top: string; left: string; size: HotspotSize; label: string };

const HOTSPOT_DEFS: HotspotDef[] = [
  { kind: "slot",    slot: FittingSlot.HeadGarment,        top: "2%",  left: "50%", size: "md", label: "Head" },
  { kind: "earring", side: "right",                         top: "8%",  left: "40%", size: "sm", label: "R. Earring" },
  { kind: "earring", side: "left",                          top: "8%",  left: "60%", size: "sm", label: "L. Earring" },
  { kind: "slot",    slot: FittingSlot.Glasses,             top: "11%", left: "50%", size: "sm", label: "Glasses" },
  { kind: "slot",    slot: FittingSlot.NeckAccessory,       top: "16%", left: "50%", size: "sm", label: "Neck" },
  { kind: "slot",    slot: FittingSlot.UpperGarment,        top: "31%", left: "50%", size: "lg", label: "Upper" },
  { kind: "slot",    slot: FittingSlot.RightHandAccessory,  top: "47%", left: "17%", size: "sm", label: "R. Hand" },
  { kind: "slot",    slot: FittingSlot.LeftHandAccessory,   top: "47%", left: "83%", size: "sm", label: "L. Hand" },
  { kind: "slot",    slot: FittingSlot.WaistAccessory,      top: "51%", left: "50%", size: "sm", label: "Waist" },
  { kind: "slot",    slot: FittingSlot.LowerGarment,        top: "67%", left: "50%", size: "lg", label: "Lower" },
  { kind: "slot",    slot: FittingSlot.FootGarment,         top: "88%", left: "50%", size: "md", label: "Footwear" },
];

// ── Body silhouette SVG ────────────────────────────────────────────────────────

function BodySilhouette() {
  return (
    <svg
      viewBox="0 0 220 640"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-auto mx-auto"
    >
      {/* Head */}
      <ellipse cx="110" cy="44" rx="28" ry="36" />

      {/* Neck */}
      <path d="M92,78 Q90,88 90,100 M128,78 Q130,88 130,100" />

      {/* Right shoulder */}
      <path d="M90,100 Q68,100 46,113 Q28,124 22,150" />
      {/* Left shoulder */}
      <path d="M130,100 Q152,100 174,113 Q192,124 198,150" />

      {/* Right arm */}
      <path d="M22,150 Q8,202 6,258 Q4,292 10,322" />
      {/* Left arm */}
      <path d="M198,150 Q212,202 214,258 Q216,292 210,322" />

      {/* Right side of torso */}
      <path d="M22,150 Q20,202 26,244 Q32,272 66,288" />
      {/* Left side of torso */}
      <path d="M198,150 Q200,202 194,244 Q188,272 154,288" />

      {/* Waist to hips — right */}
      <path d="M66,288 Q52,306 50,328 Q48,350 64,364" />
      {/* Waist to hips — left */}
      <path d="M154,288 Q168,306 170,328 Q172,350 156,364" />

      {/* Right leg outer / inner */}
      <path d="M64,364 Q60,432 58,494 Q56,540 56,578" />
      <path d="M100,364 Q100,432 100,494 Q100,540 100,578" />

      {/* Left leg inner / outer */}
      <path d="M120,364 Q120,432 120,494 Q120,540 120,578" />
      <path d="M156,364 Q160,432 162,494 Q164,540 164,578" />

      {/* Right foot */}
      <path d="M56,578 Q42,588 36,594 L100,594 Q100,588 100,578" />
      {/* Left foot */}
      <path d="M120,578 Q120,588 120,594 L184,594 Q178,588 164,578" />
    </svg>
  );
}

// ── Individual hotspot ─────────────────────────────────────────────────────────

interface HotspotProps {
  slot: GarmentSlot;
  size: HotspotSize;
  index: number;
  onPress?: (slot: GarmentSlot) => void;
}

function GarmentHotspot({ slot, size, index, onPress }: HotspotProps) {
  const sz     = SIZE[size];
  const Icon   = SLOT_ICONS[slot.slot];
  const filled = slot.garment !== null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.055, type: "spring", stiffness: 280, damping: 20 }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10"
    >
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onPress?.(slot)}
        className={cn(
          "relative rounded-full flex items-center justify-center overflow-hidden",
          sz.button,
          filled
            ? "bg-white/20 border-2 border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
            : "bg-white/10 border border-white/25 backdrop-blur-sm",
        )}
      >
        {/* Pulse ring — empty slots only */}
        {!filled && (
          <motion.span
            className="absolute inset-[-6px] rounded-full border border-white/20"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.18,
            }}
          />
        )}

        <AnimatePresence mode="wait">
          {filled && slot.garment ? (
            <motion.img
              key="img"
              src={slot.garment.imageUrl}
              alt={slot.garment.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full object-contain rounded-full"
            />
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              {Icon && <Icon className={cn("text-white/50", sz.icon)} />}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Label */}
      <span className={cn("text-white/45 uppercase tracking-widest whitespace-nowrap font-medium", sz.label)}>
        {filled && slot.garment ? slot.garment.name.split(" ")[0] : slot.label}
      </span>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface GarmentSilhouetteProps {
  slots: SlotMap;
  earringLeft?: GarmentSlot;
  earringRight?: GarmentSlot;
  onSlotPress?: (slot: GarmentSlot) => void;
  className?: string;
}

export function GarmentSilhouette({
  slots,
  earringLeft,
  earringRight,
  onSlotPress,
  className,
}: GarmentSilhouetteProps) {
  const s = (key: FittingSlot): GarmentSlot =>
    slots[key] ?? { slot: key, label: key, garment: null };

  const rEar = earringRight ?? { slot: FittingSlot.Earrings, label: "R. Earring", garment: null, side: "right" as const };
  const lEar = earringLeft  ?? { slot: FittingSlot.Earrings, label: "L. Earring", garment: null, side: "left"  as const };

  const resolveSlot = (def: HotspotDef): GarmentSlot => {
    if (def.kind === "earring") return def.side === "right" ? rEar : lEar;
    return s(def.slot);
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>

      {/* Silhouette SVG — faint body outline */}
      <div className="absolute inset-0 flex items-start justify-center pt-2">
        <BodySilhouette />
      </div>

      {/* Hotspot overlay */}
      {HOTSPOT_DEFS.map((def, i) => {
        const slot = { ...resolveSlot(def), label: def.label };
        return (
          <div
            key={`${def.kind}-${def.kind === "earring" ? def.side : def.slot}-${i}`}
            className="absolute"
            style={{ top: def.top, left: def.left }}
          >
            <GarmentHotspot
              slot={slot}
              size={def.size}
              index={i}
              onPress={onSlotPress}
            />
          </div>
        );
      })}
    </div>
  );
}
