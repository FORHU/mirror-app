"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ReactNode, Key } from "react";

const ARC_FACTOR   = 6;
const SCALE_STEP   = 0.13;
const OPACITY_STEP = 0.30;
const MAX_OFFSET   = 3;

export function ArcCarousel<T extends object>({
  items,
  renderIcon,
  onSelect,
  resetKey,
  iconBasePx = 80,
  slotPx = 96,
}: {
  items: T[];
  renderIcon: (item: T, active: boolean) => ReactNode;
  onSelect?: (item: T) => void;
  resetKey?: Key;
  iconBasePx?: number;
  slotPx?: number;
}) {
  const n        = items.length;
  const wrapItem = (vi: number): T => items[((vi % n) + n) % n];

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
