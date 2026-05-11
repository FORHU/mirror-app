"use client";

import { cn } from "@/modules/shared/utils";
import { FittingSlot, type GarmentSlot, type SlotMap } from "../types";
import { GarmentSlotCard } from "./GarmentSlotCard";

const CORNER: GarmentSlot = { slot: FittingSlot.None, label: "", garment: null };

function ZoneLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 flex-shrink-0">
      <div className="h-px flex-1 bg-white/15" />
      <span className="text-xs text-white/40 uppercase tracking-[0.18em] font-semibold px-1">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/15" />
    </div>
  );
}

interface GarmentSlotGridProps {
  slots: SlotMap;
  activeSlot?: FittingSlot | null;
  earringLeft?: GarmentSlot;
  earringRight?: GarmentSlot;
  onSlotPress?: (slot: GarmentSlot) => void;
  className?: string;
}

export function GarmentSlotGrid({
  slots,
  activeSlot = null,
  earringLeft,
  earringRight,
  onSlotPress,
  className,
}: GarmentSlotGridProps) {
  const s = (key: FittingSlot): GarmentSlot =>
    slots[key] ?? { slot: key, label: key, garment: null };

  const rEar = earringRight ?? { slot: FittingSlot.Earrings, label: "R. Earring", garment: null, side: "right" as const };
  const lEar = earringLeft  ?? { slot: FittingSlot.Earrings, label: "L. Earring", garment: null, side: "left"  as const };

  // When a FullGarment is selected it surfaces in the UpperGarment slot and
  // marks LowerGarment as covered rather than requiring a separate slot.
  const fullGarment = slots[FittingSlot.FullGarment]?.garment ?? null;
  const upperSlot: GarmentSlot = fullGarment
    ? { ...s(FittingSlot.UpperGarment), garment: fullGarment }
    : s(FittingSlot.UpperGarment);

  const isA = (slot: FittingSlot) => activeSlot === slot;

  return (
    <div className={cn("flex flex-col gap-0 w-full h-full", className)}>

      {/* ── HEAD ── */}
      <ZoneLabel label="Head" />
      <div className="flex flex-col gap-1.5" style={{ height: "22%" }}>

        {/* HeadGarment — same width as Glasses (earring-width spacers) */}
        <div className="flex flex-row gap-1.5 flex-[1.4]">
          <div className="flex-none w-[14%]" />
          <div className="flex flex-row gap-1 flex-1">
            <div className="flex-none w-[22%]" />
            <GarmentSlotCard slot={s(FittingSlot.HeadGarment)} isActive={isA(FittingSlot.HeadGarment)} index={0} onPress={onSlotPress} className="flex-1" />
            <div className="flex-none w-[22%]" />
          </div>
          <div className="flex-none w-[14%]" />
        </div>

        {/* Glasses row: R.Earring + Glasses + L.Earring */}
        <div className="flex flex-row gap-1.5 flex-1">
          <div className="flex-none w-[14%]" />
          <div className="flex flex-row gap-1 flex-1">
            <GarmentSlotCard slot={rEar}                    isActive={isA(FittingSlot.Earrings)} index={1} onPress={onSlotPress} className="flex-none w-[22%]" />
            <GarmentSlotCard slot={s(FittingSlot.Glasses)} isActive={isA(FittingSlot.Glasses)}  index={2} onPress={onSlotPress} className="flex-1" />
            <GarmentSlotCard slot={lEar}                    isActive={isA(FittingSlot.Earrings)} index={3} onPress={onSlotPress} className="flex-none w-[22%]" />
          </div>
          <div className="flex-none w-[14%]" />
        </div>

        {/* Neck row — same width as Glasses */}
        <div className="flex flex-row gap-1.5 flex-[0.8]">
          <div className="flex-none w-[14%]" />
          <div className="flex flex-row gap-1 flex-1">
            <div className="flex-none w-[22%]" />
            <GarmentSlotCard slot={s(FittingSlot.NeckAccessory)} isActive={isA(FittingSlot.NeckAccessory)} index={4} onPress={onSlotPress} className="flex-1" />
            <div className="flex-none w-[22%]" />
          </div>
          <div className="flex-none w-[14%]" />
        </div>
      </div>

      {/* ── BODY (hands span upper + lower) ── */}
      <ZoneLabel label="Upper Body" />
      <div className="flex flex-row gap-1.5" style={{ height: "50%" }}>
        <div className="flex-none w-[14%]" />
        <GarmentSlotCard
          slot={s(FittingSlot.RightHandAccessory)}
          isActive={isA(FittingSlot.RightHandAccessory)}
          index={5}
          onPress={onSlotPress}
          className="flex-none w-[14%] h-full"
        />
        <div className="flex flex-col gap-1.5 flex-1">
          <GarmentSlotCard slot={upperSlot}                      isActive={isA(FittingSlot.UpperGarment) || isA(FittingSlot.FullGarment)} index={6} onPress={onSlotPress} className="flex-[2.2]" />
          <GarmentSlotCard slot={s(FittingSlot.WaistAccessory)} isActive={isA(FittingSlot.WaistAccessory)} index={7} onPress={onSlotPress} className="flex-none h-20" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="h-px flex-1 bg-white/15" />
            <span className="text-xs text-white/40 uppercase tracking-[0.18em] font-semibold px-1">Lower Body</span>
            <div className="h-px flex-1 bg-white/15" />
          </div>
          <GarmentSlotCard slot={s(FittingSlot.LowerGarment)} isActive={isA(FittingSlot.LowerGarment)} coveredBy={fullGarment} index={8} onPress={onSlotPress} className="flex-[1.4]" />
        </div>
        <GarmentSlotCard
          slot={s(FittingSlot.LeftHandAccessory)}
          isActive={isA(FittingSlot.LeftHandAccessory)}
          index={9}
          onPress={onSlotPress}
          className="flex-none w-[14%] h-full"
        />
        <div className="flex-none w-[14%]" />
      </div>

      {/* ── FOOTWEAR ── */}
      <ZoneLabel label="Footwear" />
      <div className="flex flex-row gap-1.5" style={{ height: "14%" }}>
        <div className="flex-none w-[14%]" />
        <div className="flex-none w-[14%]" />
        <GarmentSlotCard slot={s(FittingSlot.FootGarment)} isActive={isA(FittingSlot.FootGarment)} index={10} onPress={onSlotPress} className="flex-1" />
        <div className="flex-none w-[14%]" />
        <div className="flex-none w-[14%]" />
      </div>

    </div>
  );
}
