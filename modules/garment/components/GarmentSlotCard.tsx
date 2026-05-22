"use client";
/* eslint-disable @next/next/no-img-element -- dynamic garment thumbnails */

import { motion, AnimatePresence } from "motion/react";
import {
  Crown, Glasses, Gem, Shirt, Layers, Package,
  Footprints, Watch, Link, CircleDot, Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/modules/shared/utils";
import { FittingSlot, type Garment, type GarmentSlot } from "../types";

const SLOT_ICONS: Partial<Record<FittingSlot, LucideIcon>> = {
  [FittingSlot.HeadGarment]:        Crown,
  [FittingSlot.Glasses]:            Glasses,
  [FittingSlot.Earrings]:           Gem,
  [FittingSlot.UpperGarment]:       Shirt,
  [FittingSlot.LowerGarment]:       Layers,
  [FittingSlot.FullGarment]:        Package,
  [FittingSlot.FootGarment]:        Footprints,
  [FittingSlot.LeftHandAccessory]:  Watch,
  [FittingSlot.RightHandAccessory]: Watch,
  [FittingSlot.NeckAccessory]:      Link,
  [FittingSlot.WaistAccessory]:     CircleDot,
};

interface GarmentSlotCardProps {
  slot: GarmentSlot;
  index?: number;
  isCorner?: boolean;
  isActive?: boolean;
  /** Set when a FullGarment covers this slot */
  coveredBy?: Garment | null;
  onPress?: (slot: GarmentSlot) => void;
  className?: string;
}

export function GarmentSlotCard({
  slot,
  index = 0,
  isCorner = false,
  isActive = false,
  coveredBy = null,
  onPress,
  className,
}: GarmentSlotCardProps) {
  const Icon = SLOT_ICONS[slot.slot];
  const isFilled = slot.garment !== null;

  if (isCorner) {
    return (
      <div
        className={cn(
          "rounded-lg border border-white/8 pointer-events-none",
          className,
        )}
        style={{ background: "rgba(255,255,255,0.02)" }}
      />
    );
  }

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 22 }}
      onClick={() => onPress?.(slot)}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl transition-transform active:scale-95",
        isActive
          ? "border-2 border-white/70 ring-2 ring-white/25 bg-white/12 backdrop-blur"
          : isFilled || coveredBy
            ? "border border-white/25 bg-white/12 backdrop-blur"
            : "border border-white/20 bg-white/8 backdrop-blur-sm",
        className,
      )}
    >
      <AnimatePresence mode="wait">

        {/* ── Filled with its own garment ── */}
        {isFilled && slot.garment && !coveredBy ? (
          <motion.div
            key="filled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <img
              src={slot.garment.imageUrl}
              alt={slot.garment.name}
              className="w-full h-full object-contain"
            />
          </motion.div>

        /* ── Covered by a full-body garment ── */
        ) : coveredBy ? (
          <motion.div
            key="covered"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <img
              src={coveredBy.imageUrl}
              alt={coveredBy.name}
              className="w-full h-full object-contain opacity-35"
            />
            <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-2">
              <Package className="w-7 h-7 text-white/50" />
              <span className="text-xs text-white/50 uppercase tracking-widest font-medium">
                Full Body
              </span>
              <span className="text-[10px] text-white/30 text-center px-2 leading-tight">
                tap to override
              </span>
            </div>
          </motion.div>

        /* ── Empty ── */
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-2 px-1 w-full h-full"
          >
            {Icon && <Icon className="w-9 h-9 text-white/55 flex-shrink-0" />}
            {slot.label && (
              <span className="text-xs text-white/55 uppercase tracking-widest text-center leading-tight font-medium">
                {slot.label}
              </span>
            )}
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-white/60" />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.button>
  );
}
