"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";

interface OutfitImageCarouselProps {
  /** Auto-advance interval in ms. */
  intervalMs?: number;
}

/** Fisher-Yates shuffle — returns a new randomly-ordered array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Idle "show off" reel — fetches existing outfits from the backend and
 * cross-fades through their images. Shown on the fashion page before the user
 * has any AI recommendations, so the screen isn't just black. Renders nothing
 * until outfits with images are loaded.
 */
export function OutfitImageCarousel({
  intervalMs = 4500,
}: OutfitImageCarouselProps) {
  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [idx, setIdx] = useState(0);

  // Fetch once on mount; keep only outfits with an image, in random order.
  useEffect(() => {
    let cancelled = false;
    outfitService
      .getAll()
      .then((data) => {
        if (cancelled) return;
        setOutfits(shuffle(data.filter((o) => o.file?.fileUrl)));
      })
      .catch(() => {
        /* show-off is best-effort — silently skip if it fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-advance through the random order without repeating. When a full pass
  // completes, reshuffle for a fresh random order (avoiding an immediate repeat
  // of the last image), so nothing is reused within a viewing pass.
  useEffect(() => {
    if (outfits.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => {
        if (i + 1 < outfits.length) return i + 1;
        setOutfits((q) => {
          const next = shuffle(q);
          if (q.length > 1 && next[0].id === q[i].id) {
            [next[0], next[1]] = [next[1], next[0]];
          }
          return next;
        });
        return 0;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [outfits, intervalMs]);

  if (outfits.length === 0) return null;

  const current = outfits[idx % outfits.length];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 pointer-events-none select-none">
      {/* Constant-size frame — image crossfades in place (opacity only), so it
          never moves or shrinks regardless of aspect ratio or transition. */}
      <div
        className="relative flex items-center justify-center rounded-2xl overflow-hidden"
        style={{ height: "58vh", aspectRatio: "3 / 4" }}
      >
        <AnimatePresence>
          <motion.img
            key={current.id}
            src={current.file.fileUrl}
            alt={current.name}
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 12px 60px rgba(0,0,0,0.6))" }}
          />
        </AnimatePresence>
      </div>

      {/* Fixed-height caption — name crossfades in place, never pushes the dots. */}
      <div className="h-5 w-[70%] flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-white/45 text-[11px] uppercase tracking-[0.35em] font-light text-center truncate"
          >
            {current.name}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* progress dots — uniform fixed size; active state is colour only (no resize) */}
      <div className="flex gap-1.5">
        {outfits.slice(0, 12).map((o, i) => (
          <div
            key={o.id}
            style={{
              width: 6,
              height: 6,
              borderRadius: 9999,
              background:
                i === idx % outfits.length
                  ? "rgba(255,255,255,0.85)"
                  : "rgba(255,255,255,0.22)",
              transition: "background 0.4s",
            }}
          />
        ))}
      </div>
    </div>
  );
}
