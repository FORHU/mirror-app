"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  outfitService,
  type RemoteOutfit,
} from "@/modules/shared/api/outfit.service";
import { useSwipe } from "@/modules/fashion/hooks/useSwipe";

interface OutfitImageCarouselProps {
  /** Auto-advance interval in ms. */
  intervalMs?: number;
  /** When set, only outfits matching this gender are fetched. */
  gender?: "All" | "MALE" | "FEMALE";
}

/** How many outfits per fetched batch (one batch = one stepper run). */
const BATCH = 10;

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
  gender,
}: OutfitImageCarouselProps) {
  const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
  const [idx, setIdx] = useState(0);
  const pageRef = useRef(1);
  const nextBatchRef = useRef<RemoteOutfit[] | null>(null);
  const fetchingRef = useRef(false);

  // Fetch one page of outfits with images, in random order.
  const fetchBatch = useCallback(
    async (page: number): Promise<RemoteOutfit[]> => {
      let data: RemoteOutfit[];
      if (gender && gender !== "All") {
        const qs = new URLSearchParams({
          page: String(page),
          limit: String(BATCH),
          metaGender: gender,
        }).toString();
        data = await outfitService
          .getByQuery(qs)
          .catch(() => [] as RemoteOutfit[]);
      } else {
        data = await outfitService
          .getAll(page, BATCH)
          .catch(() => [] as RemoteOutfit[]);
      }
      return shuffle(data.filter((o) => o.file?.fileUrl));
    },
    [gender],
  );

  // Initial batch — reset fully when gender changes.
  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;
    nextBatchRef.current = null;
    fetchingRef.current = false;
    queueMicrotask(() => {
      setOutfits([]);
      setIdx(0);
    });
    fetchBatch(1).then((b) => {
      if (cancelled) return;
      setOutfits(b);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchBatch]);

  // As the stepper nears the end of the current batch, prefetch the NEXT batch
  // from the backend so the reel keeps pulling fresh outfits. Wraps back to
  // page 1 when a page returns empty (past the end of the catalog).
  useEffect(() => {
    if (outfits.length <= 1 || idx < outfits.length - 1) return;
    if (fetchingRef.current || nextBatchRef.current) return;
    fetchingRef.current = true;
    (async () => {
      const nextPage = pageRef.current + 1;
      let batch = await fetchBatch(nextPage);
      let page = nextPage;
      if (batch.length === 0) {
        batch = await fetchBatch(1);
        page = 1;
      }
      pageRef.current = page;
      nextBatchRef.current = batch.length ? batch : null;
      fetchingRef.current = false;
    })();
  }, [idx, outfits.length, fetchBatch]);

  const [interactionKey, setInteractionKey] = useState(0);

  const nextImage = useCallback(() => {
    setInteractionKey((k) => k + 1);
    setIdx((i) => {
      if (i + 1 < outfits.length) return i + 1;
      const next = nextBatchRef.current;
      if (next && next.length) {
        nextBatchRef.current = null;
        setOutfits(next);
      } else {
        setOutfits((q) => {
          const r = shuffle(q);
          if (q.length > 1 && r[0].id === q[i].id) {
            [r[0], r[1]] = [r[1], r[0]];
          }
          return r;
        });
      }
      return 0;
    });
  }, [outfits.length]);

  const prevImage = useCallback(() => {
    setInteractionKey((k) => k + 1);
    setIdx((i) => {
      if (i - 1 >= 0) return i - 1;
      return outfits.length - 1;
    });
  }, [outfits.length]);

  const swipeProps = useSwipe(nextImage, prevImage);

  // Auto-advance. When the batch finishes, swap to the prefetched next batch
  // (fresh outfits from the backend); fall back to reshuffling if it isn't ready.
  useEffect(() => {
    if (outfits.length <= 1) return;
    const id = setInterval(nextImage, intervalMs);
    return () => clearInterval(id);
  }, [outfits.length, intervalMs, nextImage, interactionKey]);

  if (outfits.length === 0) return null;

  const current = outfits[idx % outfits.length];

  return (
    <div
      {...swipeProps}
      className="w-full h-full flex flex-col items-center justify-center gap-3 select-none cursor-grab active:cursor-grabbing"
      style={{ touchAction: "pan-y", zIndex: 0 }}
    >
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

      {/* Caption — name crossfades in place, clamp to 2 lines so nothing gets cut */}
      <div className="w-[70%] h-[40px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-white/45 text-[11px] uppercase tracking-[0.35em] font-light text-center line-clamp-2"
          >
            {current.name}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* progress dots — uniform fixed size; active state is colour only (no resize) */}
      <div className="flex gap-1.5 mb-6">
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
