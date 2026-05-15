"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { GarmentSlotGrid } from "@/modules/garment/components/GarmentSlotGrid";
import {
  createEmptySlotMap,
  type GarmentSlot,
  type SlotMap,
} from "@/modules/garment/types";
import GarmentCarouselModal, { type ModalItem } from "@/components/GarmentCarouselModal";
import { garmentService, type RemoteGarment } from "@/modules/shared/api/garment.service";

const NONE: ModalItem = { id: "none", label: "None", imageUrl: null, garment: null };

function toModalItem(g: RemoteGarment, slot: GarmentSlot["slot"]): ModalItem {
  const name        = g.name.replace(/^"|"$/g, "");
  const imageUrl    = g.file?.fileUrl ?? g.imageUrl ?? null;
  const garmentType = (g.garmentType?.[0] ?? "").toLowerCase();
  return {
    id: g.id,
    label: name,
    imageUrl,
    garment: { id: g.id, name, imageUrl, slot, garmentType },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutfitBuilderPage() {
  const router = useRouter();
  const [photo, setPhoto]           = useState<string | null>(null);
  const [slotMap, setSlotMap]       = useState<SlotMap>(createEmptySlotMap);
  const [activeSlot, setActiveSlot] = useState<GarmentSlot | null>(null);
  const [items, setItems]           = useState<ModalItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mirror_captured_photo");
    if (stored) setPhoto(stored);
  }, []);

  async function handleSlotPress(slot: GarmentSlot) {
    setActiveSlot(slot);
    setItems([]);
    setLoadingItems(true);
    try {
      const data = await garmentService.getBySlot(slot.slot);
      setItems([NONE, ...data.map(g => toModalItem(g, slot.slot))]);
    } catch {
      setItems([NONE]);
    } finally {
      setLoadingItems(false);
    }
  }

  function handleConfirm(item: ModalItem) {
    if (activeSlot) {
      setSlotMap(prev => ({
        ...prev,
        [activeSlot.slot]: { ...activeSlot, garment: item.garment },
      }));
    }
    setActiveSlot(null);
  }

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
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              filter: activeSlot ? "blur(22px) brightness(0.5)" : "blur(0px) brightness(1)",
            }}
            transition={{
              opacity: { duration: 0.5 },
              filter:  { duration: 0.4, ease: "easeInOut" },
            }}
            className="absolute inset-0 bg-[#0c0b18]"
          />
        )}
      </AnimatePresence>

      {/* Dark overlay — always present */}
      <div className="absolute inset-0 bg-black/50" />

      {/* ── MAIN: garment slot grid ── */}
      <section
        className="absolute top-0 left-0 right-0 z-20 px-4 flex flex-col pt-4"
        style={{ bottom: "var(--zone-footer)" }}
      >
        <GarmentSlotGrid
          slots={slotMap}
          activeSlot={activeSlot?.slot ?? null}
          onSlotPress={handleSlotPress}
          className="flex-1 w-full"
        />
      </section>

      {/* ── FOOTER: nav buttons ── */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 flex flex-col justify-end pb-16" style={{ height: "var(--zone-footer)" }}>
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
            onClick={() => {
              localStorage.setItem("mirror_outfit_slots", JSON.stringify(slotMap));
              router.push("/try-it-on");
            }}
            className="flex-[2] py-5 rounded-2xl text-white font-bold text-xl"
            style={{ background: "linear-gradient(135deg, #7c6ff7 0%, #10d49a 100%)", boxShadow: "0 6px 24px rgba(124,111,247,0.30)" }}
          >
            Try It On
          </motion.button>
        </div>
      </footer>

      {/* ── CAROUSEL MODAL ── */}
      <GarmentCarouselModal
        activeSlot={activeSlot}
        items={items}
        loading={loadingItems}
        onClose={() => setActiveSlot(null)}
        onConfirm={handleConfirm}
      />

    </main>
  );
}
