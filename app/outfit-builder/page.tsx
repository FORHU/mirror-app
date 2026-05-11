"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { GarmentSlotGrid } from "@/modules/garment/components/GarmentSlotGrid";
import {
  FittingSlot,
  createEmptySlotMap,
  type Garment,
  type GarmentSlot,
  type SlotMap,
} from "@/modules/garment/types";

// ── Mock data ─────────────────────────────────────────────────────────────────

type ModalItem = {
  id: string;
  label: string;
  imageUrl: string | null;
  garment: Garment | null;
};

function mk(id: string, label: string, url: string, slot: FittingSlot): ModalItem {
  return { id, label, imageUrl: url, garment: { id, name: label, imageUrl: url, slot } };
}
const NONE: ModalItem = { id: "none", label: "None", imageUrl: null, garment: null };

const SLOT_ITEMS: Partial<Record<FittingSlot, ModalItem[]>> = {
  [FittingSlot.HeadGarment]: [
    NONE,
    mk("cap",    "Cap",    "https://pngimg.com/uploads/cap/cap_PNG8.png",        FittingSlot.HeadGarment),
    mk("hat",    "Hat",    "https://pngimg.com/uploads/hat/hat_PNG7595.png",     FittingSlot.HeadGarment),
    mk("beanie", "Beanie", "https://pngimg.com/uploads/beanie/beanie_PNG17.png", FittingSlot.HeadGarment),
  ],
  [FittingSlot.Glasses]: [
    NONE,
    mk("sunnies",    "Sunglasses", "https://pngimg.com/uploads/sunglasses/sunglasses_PNG8.png", FittingSlot.Glasses),
    mk("eyeglasses", "Eyeglasses", "https://pngimg.com/uploads/glasses/glasses_PNG8405.png",   FittingSlot.Glasses),
  ],
  [FittingSlot.Earrings]: [
    NONE,
    mk("hoops", "Hoops", "https://pngimg.com/uploads/earring/earring_PNG11.png", FittingSlot.Earrings),
    mk("studs", "Studs", "https://pngimg.com/uploads/earring/earring_PNG6.png",  FittingSlot.Earrings),
  ],
  [FittingSlot.NeckAccessory]: [
    NONE,
    mk("necklace", "Necklace", "https://pngimg.com/uploads/necklace/necklace_PNG28.png", FittingSlot.NeckAccessory),
    mk("scarf",    "Scarf",    "https://pngimg.com/uploads/scarf/scarf_PNG21.png",       FittingSlot.NeckAccessory),
  ],
  [FittingSlot.UpperGarment]: [
    NONE,
    mk("tshirt", "T-Shirt", "https://pngimg.com/uploads/tshirt/tshirt_PNG5436.png", FittingSlot.UpperGarment),
    mk("hoodie", "Hoodie",  "https://pngimg.com/uploads/hoodie/hoodie_PNG12.png",   FittingSlot.UpperGarment),
  ],
  [FittingSlot.WaistAccessory]: [
    NONE,
    mk("belt",  "Belt",  "https://pngimg.com/uploads/belt/belt_PNG7.png",   FittingSlot.WaistAccessory),
    mk("chain", "Chain", "https://pngimg.com/uploads/chain/chain_PNG8.png", FittingSlot.WaistAccessory),
  ],
  [FittingSlot.LowerGarment]: [
    NONE,
    mk("jeans",  "Jeans",  "https://pngimg.com/uploads/jeans/jeans_PNG7.png",    FittingSlot.LowerGarment),
    mk("skirt",  "Skirt",  "https://pngimg.com/uploads/skirt/skirt_PNG7.png",    FittingSlot.LowerGarment),
    mk("shorts", "Shorts", "https://pngimg.com/uploads/shorts/shorts_PNG25.png", FittingSlot.LowerGarment),
  ],
  [FittingSlot.FullGarment]: [
    NONE,
    mk("dress",    "Dress",    "https://pngimg.com/uploads/dress/dress_PNG46.png",       FittingSlot.FullGarment),
    mk("jumpsuit", "Jumpsuit", "https://pngimg.com/uploads/jumpsuit/jumpsuit_PNG13.png", FittingSlot.FullGarment),
  ],
  [FittingSlot.FootGarment]: [
    NONE,
    mk("sneakers", "Sneakers", "https://pngimg.com/uploads/shoe/shoe_PNG7654.png", FittingSlot.FootGarment),
    mk("heels",    "Heels",    "https://pngimg.com/uploads/shoe/shoe_PNG7673.png", FittingSlot.FootGarment),
    mk("boots",    "Boots",    "https://pngimg.com/uploads/boots/boots_PNG8.png",  FittingSlot.FootGarment),
  ],
  [FittingSlot.LeftHandAccessory]: [
    NONE,
    mk("watch-l",    "Watch",    "https://pngimg.com/uploads/watches/watches_PNG9848.png", FittingSlot.LeftHandAccessory),
    mk("bracelet-l", "Bracelet", "https://pngimg.com/uploads/bracelet/bracelet_PNG7.png",  FittingSlot.LeftHandAccessory),
  ],
  [FittingSlot.RightHandAccessory]: [
    NONE,
    mk("watch-r",    "Watch",    "https://pngimg.com/uploads/watches/watches_PNG9848.png", FittingSlot.RightHandAccessory),
    mk("bracelet-r", "Bracelet", "https://pngimg.com/uploads/bracelet/bracelet_PNG7.png",  FittingSlot.RightHandAccessory),
  ],
};

// ── Page ──────────────────────────────────────────────────────────────────────

const CARD_RATIO = 0.58;
const CARD_GAP   = 16;

export default function OutfitBuilderPage() {
  const router = useRouter();
  const [photo, setPhoto]           = useState<string | null>(null);
  const [slotMap, setSlotMap]       = useState<SlotMap>(createEmptySlotMap);
  const [activeSlot, setActiveSlot] = useState<GarmentSlot | null>(null);

  // Infinite carousel — use refs for drag values so event handlers never go stale
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

  useEffect(() => {
    const stored = localStorage.getItem("mirror_captured_photo");
    if (stored) setPhoto(stored);
  }, []);

  // Reset and re-measure when a new slot is opened
  useEffect(() => {
    const sp = window.innerWidth * CARD_RATIO + CARD_GAP;
    slotPxRef.current   = sp;
    centerVIRef.current = 0;
    dragPxRef.current   = 0;
    setCenterVI(0);
    setDragPx(0);
    setSlotPx(sp);
  }, [activeSlot?.slot]);

  const items = activeSlot ? (SLOT_ITEMS[activeSlot.slot] ?? [NONE]) : [];
  const n     = items.length;
  const wrap  = (vi: number) => items[((vi % n) + n) % n];

  const effectiveVI = centerVI - dragPx / slotPx;
  const lo = Math.floor(effectiveVI) - 2;
  const hi = Math.ceil(effectiveVI)  + 2;
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
    // Use refs — guaranteed fresh even if React batched renders
    const snapped = Math.round(centerVIRef.current - dragPxRef.current / slotPxRef.current);
    centerVIRef.current = snapped;
    dragPxRef.current   = 0;
    setCenterVI(snapped);
    setDragPx(0);
  }

  function handleSlotPress(slot: GarmentSlot) {
    setActiveSlot(slot);
  }

  function handleConfirm() {
    const item = n > 0 ? wrap(Math.round(centerVIRef.current - dragPxRef.current / slotPxRef.current)) : NONE;
    if (activeSlot) {
      setSlotMap(prev => ({
        ...prev,
        [activeSlot.slot]: { ...activeSlot, garment: item.garment },
      }));
    }
    setActiveSlot(null);
  }

  const containerH = `calc(${CARD_RATIO * 100}vw + 52px)`;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">

      {/* ── Background photo ── */}
      <AnimatePresence>
        {photo ? (
          <motion.div
            key="photo"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 160, damping: 20 }}
            className="absolute inset-0"
            style={{
              filter: activeSlot ? "blur(22px) brightness(0.5)" : "none",
              transition: "filter 0.4s ease",
            }}
          >
            <img
              src={photo}
              alt="Your captured photo"
              draggable={false}
              className="w-full h-full object-cover"
            />
          </motion.div>
        ) : (
          <motion.div
            key="gradient"
            initial={{ opacity: 0, filter: "blur(0px) brightness(1)" }}
            animate={{
              opacity: 1,
              filter: activeSlot ? "blur(22px) brightness(0.5)" : "blur(0px) brightness(1)",
            }}
            transition={{
              opacity: { duration: 0.5 },
              filter:  { duration: 0.4, ease: "easeInOut" },
            }}
            className="absolute inset-0 bg-gradient-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca]"
          />
        )}
      </AnimatePresence>

      {/* Dark overlay — always present */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Vignette — extra darken + edge fade when carousel is open */}
      <AnimatePresence>
        {activeSlot && (
          <motion.div
            key="vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: [
                "radial-gradient(ellipse 90% 60% at 50% 50%, transparent 20%, rgba(0,0,0,0.75) 100%)",
                "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.55) 100%)",
              ].join(", "),
            }}
          />
        )}
      </AnimatePresence>

      {/* ── MAIN: garment slot grid ── */}
      <section className="mirror-main relative z-20 px-6 flex flex-col">
        <div className="flex-[0.18]" />
        <GarmentSlotGrid
          slots={slotMap}
          activeSlot={activeSlot?.slot ?? null}
          onSlotPress={handleSlotPress}
          className="flex-1 mx-auto w-full"
        />
      </section>

      {/* ── FOOTER: nav buttons ── */}
      <footer className="mirror-footer relative z-20 flex flex-col justify-end pb-2">
        <div className="flex items-center gap-3 px-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.back()}
            className="flex-1 py-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur text-white font-semibold text-xl"
          >
            Back
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/capture-picture")}
            className="flex-[2] py-5 rounded-2xl bg-gradient-to-r from-[#8b7fc7] to-[#ffa07a] text-white font-bold text-xl shadow-lg"
          >
            Try It On
          </motion.button>
        </div>
      </footer>

      {/* ── CAROUSEL OVERLAY ── */}
      <AnimatePresence>
        {activeSlot && (
          <motion.div
            key="carousel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5"
          >
            {/* Slot label + close */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="flex items-center gap-3"
            >
              <span className="text-white/55 text-sm uppercase tracking-widest font-medium">
                {activeSlot.label}
              </span>
              <button
                onClick={() => setActiveSlot(null)}
                className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </motion.div>

            {/* ── Infinite drag carousel ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.04 }}
              className="relative w-full cursor-grab active:cursor-grabbing select-none"
              style={{ height: containerH, touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {n > 0 && vis.map(vi => {
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
                    className="absolute top-0 flex flex-col items-center gap-3"
                    style={{ width: `${CARD_RATIO * 100}%`, left: `${(1 - CARD_RATIO) / 2 * 100}%` }}
                    initial={{ x, opacity, scale }}
                    animate={{ x, opacity, scale }}
                    transition={
                      isDragging.current
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 360, damping: 32, mass: 0.85 }
                    }
                  >
                    {/* Card */}
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

                    {/* Label */}
                    <span className={`font-medium text-sm ${isCenter ? "text-white" : "text-white/30"}`}>
                      {item.label}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Select button */}
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ delay: 0.08 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleConfirm}
              className="px-20 py-4 rounded-2xl bg-white text-black font-bold text-lg shadow-lg"
            >
              Select
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
