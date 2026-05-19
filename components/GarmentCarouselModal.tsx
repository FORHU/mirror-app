"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { Garment, GarmentSlot } from "@/modules/garment/types";

export type ModalItem = {
  id: string;
  label: string;
  imageUrl: string | null;
  garment: Garment | null;
};

interface GarmentCarouselModalProps {
  activeSlot: GarmentSlot | null;
  items: ModalItem[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (item: ModalItem) => void;
}

const CARD_RATIO = 0.58;
const CARD_GAP   = 16;

export default function GarmentCarouselModal({
  activeSlot,
  items,
  loading = false,
  onClose,
  onConfirm,
}: GarmentCarouselModalProps) {
  const [centerVI, setCenterVI] = useState(0);
  const [dragPx,   setDragPx]   = useState(0);
  const [slotPx,   setSlotPx]   = useState(
    () => (typeof window !== "undefined" ? window.innerWidth * CARD_RATIO + CARD_GAP : 260)
  );

  const isDragging  = useRef(false);
  const startX      = useRef(0);
  const dragPxRef   = useRef(0);
  const centerVIRef = useRef(0);
  const slotPxRef   = useRef(slotPx);

  // Reset position when the slot changes
  useEffect(() => {
    const sp = window.innerWidth * CARD_RATIO + CARD_GAP;
    slotPxRef.current = sp;
    dragPxRef.current = 0;
    setDragPx(0);
    setSlotPx(sp);
    centerVIRef.current = 0;
    setCenterVI(0);
  }, [activeSlot?.slot]);

  // Jump to the already-selected item once items finish loading
  useEffect(() => {
    if (items.length === 0) return;
    const selectedId = activeSlot?.garment?.id ?? "none";
    const idx = items.findIndex(item => item.id === selectedId);
    if (idx > 0) {
      centerVIRef.current = idx;
      dragPxRef.current = 0;
      setCenterVI(idx);
      setDragPx(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const n    = items.length;
  const wrap = (vi: number) => items[((vi % n) + n) % n];

  const effectiveVI = centerVI - dragPx / slotPx;
  const lo  = Math.floor(effectiveVI) - 2;
  const hi  = Math.ceil(effectiveVI)  + 2;
  const vis = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    isDragging.current = true;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    dragPxRef.current = dx;
    setDragPx(dx);
  }
  function onPointerUp() {
    if (!isDragging.current) return;
    isDragging.current = false;
    const snapped = Math.round(centerVIRef.current - dragPxRef.current / slotPxRef.current);
    centerVIRef.current = snapped;
    dragPxRef.current   = 0;
    setCenterVI(snapped);
    setDragPx(0);
  }

  function handleConfirm() {
    const item = n > 0
      ? wrap(Math.round(centerVIRef.current - dragPxRef.current / slotPxRef.current))
      : items[0];
    onConfirm(item);
  }

  const containerH = `calc(${CARD_RATIO * 100}vw + 52px)`;

  return (
    <AnimatePresence>
      {activeSlot && (
        <motion.div
          key="carousel-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex flex-col items-center"
          style={{
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          }}
        >
          {/* ── Header — pinned top ── */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className="flex-none flex items-center gap-3 pt-10 pb-4"
          >
            <span className="text-white/55 text-sm uppercase tracking-widest font-medium">
              {activeSlot.label}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </motion.div>

          {/* ── Carousel — fills remaining space ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.04 }}
            className="flex-1 relative w-full min-h-0 cursor-grab active:cursor-grabbing select-none"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              </div>
            )}
            {!loading && n > 0 && vis.map(vi => {
              const offset    = vi - effectiveVI;
              const absOffset = Math.abs(offset);
              if (absOffset > 2.2) return null;

              const item     = wrap(vi);
              const isCenter = absOffset < 0.5;
              const x        = offset * slotPx;
              const opacity  = isCenter ? 1 : Math.max(0, 1 - absOffset * 0.72);
              const scale    = isCenter ? 1 : 0.88;

              return (
                <motion.div
                  key={vi}
                  className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-3"
                  style={{
                    width: `${CARD_RATIO * 100}%`,
                    left: `${(1 - CARD_RATIO) / 2 * 100}%`,
                  }}
                  initial={{ x, opacity, scale }}
                  animate={{ x, opacity, scale }}
                  transition={
                    isDragging.current
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 360, damping: 32, mass: 0.85 }
                  }
                >
                  <div
                    className={`w-full rounded-3xl flex items-center justify-center ${
                      item.imageUrl ? "bg-white" : "bg-white/10 border-2 border-white/30"
                    } ${isCenter ? "shadow-[0_8px_48px_rgba(255,255,255,0.22)] ring-2 ring-white/40" : ""}`}
                    style={{ width: "100%", aspectRatio: "1 / 1" }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        draggable={false}
                        className="w-full h-full object-contain p-5"
                      />
                    ) : (
                      <span className="font-semibold text-white text-xl">None</span>
                    )}
                  </div>
                  <span className={`font-medium text-sm w-full text-center truncate px-2 ${isCenter ? "text-white" : "text-white/30"}`}>
                    {item.label}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ── Select button — pinned bottom ── */}
          <motion.button
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ delay: 0.08 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleConfirm}
            className="flex-none relative z-10 px-20 py-4 rounded-2xl bg-white text-black font-bold text-lg shadow-lg mb-10"
          >
            Select
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
