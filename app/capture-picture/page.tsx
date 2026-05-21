"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArcCarousel } from "../../components/ArcCarousel";

type ProductItem = { id: string; imageUrl: string | null; label: string };

const PRODUCT_ITEMS: ProductItem[] = [
  { id: "none", label: "None",     imageUrl: null },
  { id: "0",    label: "T-Shirt",  imageUrl: "https://pngimg.com/uploads/tshirt/tshirt_PNG5436.png" },
  { id: "1",    label: "Hoodie",   imageUrl: "https://pngimg.com/uploads/hoodie/hoodie_PNG12.png" },
  { id: "2",    label: "Jeans",    imageUrl: "https://pngimg.com/uploads/jeans/jeans_PNG7.png" },
  { id: "3",    label: "Sneakers", imageUrl: "https://pngimg.com/uploads/shoe/shoe_PNG7654.png" },
  { id: "4",    label: "Dress",    imageUrl: "https://pngimg.com/uploads/dress/dress_PNG46.png" },
];

export default function CapturePicturePage() {
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mirror_captured_photo");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setPhoto(stored);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">

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

      <div className="absolute bottom-0 left-0 right-0 z-20">
        <ArcCarousel<ProductItem>
          items={PRODUCT_ITEMS}
          iconBasePx={128}
          slotPx={136}
          renderIcon={(item, active) => (
            <div
              className={`rounded-full flex items-center justify-center transition-all duration-150 ${
                active
                  ? "w-32 h-32 shadow-[0_6px_36px_rgba(255,255,255,0.55)]"
                  : "w-24 h-24 opacity-70"
              } ${item.imageUrl ? "bg-white" : "bg-white/20 border-2 border-white/60"}`}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.label}
                  draggable={false}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className={`font-semibold text-white transition-all duration-150 ${active ? "text-base" : "text-sm"}`}>
                  None
                </span>
              )}
            </div>
          )}
        />
      </div>
    </main>
  );
}
