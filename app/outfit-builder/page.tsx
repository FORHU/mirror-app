"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArcCarousel } from "@/components/ArcCarousel";
import { GarmentSlotGrid } from "@/modules/garment/components/GarmentSlotGrid";
import {
  FittingSlot,
  createEmptySlotMap,
  type Garment,
  type GarmentSlot,
  type SlotMap,
} from "@/modules/garment/types";

// ── Per-slot mock garment catalogue ───────────────────────────────────────────

type CarouselItem = {
  id: string;
  label: string;
  imageUrl: string | null;
  garment: Garment | null;
};

function item(id: string, label: string, url: string, slot: FittingSlot): CarouselItem {
  return { id, label, imageUrl: url, garment: { id, name: label, imageUrl: url, slot } };
}
const NONE: CarouselItem = { id: "none", label: "None", imageUrl: null, garment: null };

const SLOT_ITEMS: Partial<Record<FittingSlot, CarouselItem[]>> = {
  [FittingSlot.HeadGarment]: [
    NONE,
    item("cap",    "Cap",    "https://pngimg.com/uploads/cap/cap_PNG8.png",          FittingSlot.HeadGarment),
    item("hat",    "Hat",    "https://pngimg.com/uploads/hat/hat_PNG7595.png",       FittingSlot.HeadGarment),
    item("beanie", "Beanie", "https://pngimg.com/uploads/beanie/beanie_PNG17.png",   FittingSlot.HeadGarment),
  ],
  [FittingSlot.Glasses]: [
    NONE,
    item("sunnies",    "Sunglasses", "https://pngimg.com/uploads/sunglasses/sunglasses_PNG8.png",   FittingSlot.Glasses),
    item("eyeglasses", "Eyeglasses", "https://pngimg.com/uploads/glasses/glasses_PNG8405.png",     FittingSlot.Glasses),
  ],
  [FittingSlot.Earrings]: [
    NONE,
    item("hoops",  "Hoops",  "https://pngimg.com/uploads/earring/earring_PNG11.png", FittingSlot.Earrings),
    item("studs",  "Studs",  "https://pngimg.com/uploads/earring/earring_PNG6.png",  FittingSlot.Earrings),
  ],
  [FittingSlot.NeckAccessory]: [
    NONE,
    item("necklace", "Necklace", "https://pngimg.com/uploads/necklace/necklace_PNG28.png", FittingSlot.NeckAccessory),
    item("scarf",    "Scarf",    "https://pngimg.com/uploads/scarf/scarf_PNG21.png",       FittingSlot.NeckAccessory),
  ],
  [FittingSlot.UpperGarment]: [
    NONE,
    item("tshirt", "T-Shirt", "https://pngimg.com/uploads/tshirt/tshirt_PNG5436.png", FittingSlot.UpperGarment),
    item("hoodie", "Hoodie",  "https://pngimg.com/uploads/hoodie/hoodie_PNG12.png",   FittingSlot.UpperGarment),
  ],
  [FittingSlot.WaistAccessory]: [
    NONE,
    item("belt",  "Belt",  "https://pngimg.com/uploads/belt/belt_PNG7.png",         FittingSlot.WaistAccessory),
    item("chain", "Chain", "https://pngimg.com/uploads/chain/chain_PNG8.png",       FittingSlot.WaistAccessory),
  ],
  [FittingSlot.LowerGarment]: [
    NONE,
    item("jeans",   "Jeans",   "https://pngimg.com/uploads/jeans/jeans_PNG7.png",    FittingSlot.LowerGarment),
    item("skirt",   "Skirt",   "https://pngimg.com/uploads/skirt/skirt_PNG7.png",    FittingSlot.LowerGarment),
    item("shorts",  "Shorts",  "https://pngimg.com/uploads/shorts/shorts_PNG25.png", FittingSlot.LowerGarment),
  ],
  [FittingSlot.FullGarment]: [
    NONE,
    item("dress",    "Dress",    "https://pngimg.com/uploads/dress/dress_PNG46.png",       FittingSlot.FullGarment),
    item("jumpsuit", "Jumpsuit", "https://pngimg.com/uploads/jumpsuit/jumpsuit_PNG13.png", FittingSlot.FullGarment),
  ],
  [FittingSlot.FootGarment]: [
    NONE,
    item("sneakers", "Sneakers", "https://pngimg.com/uploads/shoe/shoe_PNG7654.png",   FittingSlot.FootGarment),
    item("heels",    "Heels",    "https://pngimg.com/uploads/shoe/shoe_PNG7673.png",   FittingSlot.FootGarment),
    item("boots",    "Boots",    "https://pngimg.com/uploads/boots/boots_PNG8.png",    FittingSlot.FootGarment),
  ],
  [FittingSlot.LeftHandAccessory]: [
    NONE,
    item("watch-l",    "Watch",    "https://pngimg.com/uploads/watches/watches_PNG9848.png", FittingSlot.LeftHandAccessory),
    item("bracelet-l", "Bracelet", "https://pngimg.com/uploads/bracelet/bracelet_PNG7.png",  FittingSlot.LeftHandAccessory),
  ],
  [FittingSlot.RightHandAccessory]: [
    NONE,
    item("watch-r",    "Watch",    "https://pngimg.com/uploads/watches/watches_PNG9848.png", FittingSlot.RightHandAccessory),
    item("bracelet-r", "Bracelet", "https://pngimg.com/uploads/bracelet/bracelet_PNG7.png",  FittingSlot.RightHandAccessory),
  ],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutfitBuilderPage() {
  const router = useRouter();
  const [photo, setPhoto]         = useState<string | null>(null);
  const [slotMap, setSlotMap]     = useState<SlotMap>(createEmptySlotMap);
  const [activeSlot, setActiveSlot] = useState<GarmentSlot | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mirror_captured_photo");
    if (stored) setPhoto(stored);
  }, []);

  function handleSlotPress(slot: GarmentSlot) {
    setActiveSlot(prev => (prev?.slot === slot.slot ? null : slot));
  }

  function handleGarmentSelect(item: CarouselItem) {
    if (!activeSlot) return;
    setSlotMap(prev => ({
      ...prev,
      [activeSlot.slot]: { ...activeSlot, garment: item.garment },
    }));
  }

  const carouselItems = activeSlot ? (SLOT_ITEMS[activeSlot.slot] ?? [NONE]) : [];

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">

      {/* ── Background photo ── */}
      <AnimatePresence>
        {photo ? (
          <motion.img
            key="photo"
            src={photo}
            alt="Your captured photo"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 160, damping: 20 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <motion.div
            key="gradient"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-br from-[#d8b4fe] via-[#f5d0fe] to-[#fecaca]"
          />
        )}
      </AnimatePresence>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

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

      {/* ── FOOTER: carousel (slot selected) or nav buttons ── */}
      <footer className="mirror-footer relative z-20 flex flex-col justify-end pb-2">
        <AnimatePresence mode="wait">
          {activeSlot ? (
            <motion.div
              key="carousel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between px-6">
                <span className="text-white/50 text-sm uppercase tracking-widest font-medium">
                  {activeSlot.label}
                </span>
                <button
                  onClick={() => setActiveSlot(null)}
                  className="text-sm text-white/70 bg-white/10 border border-white/20 rounded-full px-5 py-1.5 active:scale-95 transition-transform"
                >
                  Done
                </button>
              </div>
              <ArcCarousel<CarouselItem>
                items={carouselItems}
                resetKey={activeSlot.slot}
                iconBasePx={132}
                slotPx={148}
                onSelect={handleGarmentSelect}
                renderIcon={(item, active) => (
                  <div
                    className={`rounded-full flex items-center justify-center transition-all duration-150 ${
                      active
                        ? "w-32 h-32 shadow-[0_4px_36px_rgba(255,255,255,0.5)]"
                        : "w-24 h-24 opacity-65"
                    } ${item.imageUrl ? "bg-white" : "bg-white/20 border-2 border-white/50"}`}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        draggable={false}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <span className={`font-semibold text-white ${active ? "text-base" : "text-sm"}`}>
                        None
                      </span>
                    )}
                  </div>
                )}
              />
            </motion.div>
          ) : (
            <motion.div
              key="nav"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="flex items-center gap-3 px-6"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

    </main>
  );
}
