"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import MirrorHeader from "@/components/MirrorHeader";
import {
  cosmeticsService,
  type CosmeticProduct,
} from "@/modules/shared/api/cosmetics.service";
import {
  SKIN_TYPE_FILTERS,
  matchesSkinType,
  type SkinTypeKey,
} from "@/modules/cosmetics/constants";

const SKIN_TYPES = Object.keys(SKIN_TYPE_FILTERS) as SkinTypeKey[];

/** ms between auto-advances; interaction pauses autoplay for RESUME_DELAY. */
const AUTOPLAY_INTERVAL = 3200;
const RESUME_DELAY = 5000;

function ProductCard({ product }: { product: CosmeticProduct }) {
  return (
    <div
      data-card
      className="flex flex-col items-center rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06]"
      style={{
        width: "var(--card)",
        scrollSnapAlign: "start",
        flex: "0 0 auto",
      }}
    >
      <div
        className="w-full flex items-center justify-center p-5"
        style={{ height: "calc(var(--card) * 0.9)" }}
      >
        {product.fileUrl?.fileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.fileUrl.fileUrl}
            alt={product.name}
            draggable={false}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        ) : (
          <span className="text-white/20 text-[10px] uppercase tracking-widest">
            Product
          </span>
        )}
      </div>
      <div className="w-full px-4 pb-6 text-center">
        <div
          className="text-white/40 uppercase truncate tracking-[0.16em]"
          style={{ fontSize: "clamp(11px, 1.1vw, 16px)" }}
        >
          {product.brand || "Brand"}
        </div>
        <div
          className="text-white/85 font-medium leading-tight overflow-hidden mt-1"
          style={{
            fontSize: "clamp(15px, 1.5vw, 23px)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            minHeight: "2.4em",
          }}
        >
          {product.name}
        </div>
        {product.type && (
          <span
            className="inline-block mt-3 px-3.5 py-1 rounded-full uppercase tracking-[0.16em] text-white/50 bg-white/[0.06]"
            style={{ fontSize: "clamp(10px, 1vw, 14px)" }}
          >
            {product.type.replace(/_/g, " ")}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-xl bg-white/[0.04]"
      style={{
        width: "var(--card)",
        height: "calc(var(--card) * 1.45)",
        flex: "0 0 auto",
      }}
    />
  );
}

export default function CosmeticProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<CosmeticProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skinType, setSkinType] = useState<SkinTypeKey>("NORMAL");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Autoplay holds off until this timestamp; any user interaction pushes it out.
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    cosmeticsService
      .getAllProducts()
      .then((items) => {
        if (cancelled) return;
        setProducts(items);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => products.filter((p) => matchesSkinType(p, skinType)),
    [products, skinType],
  );

  // Restart from the first card whenever the skin type changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [skinType]);

  // Auto-advance one card at a time; wraps to the start at the end.
  useEffect(() => {
    if (loading || filtered.length < 2) return;
    const id = window.setInterval(() => {
      const el = scrollRef.current;
      if (!el || Date.now() < pausedUntilRef.current) return;
      const card = el.querySelector<HTMLElement>("[data-card]");
      const step = (card?.offsetWidth ?? 160) + 14;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - step / 2;
      if (atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: step, behavior: "smooth" });
    }, AUTOPLAY_INTERVAL);
    return () => window.clearInterval(id);
  }, [loading, filtered.length]);

  const pauseAutoplay = () => {
    pausedUntilRef.current = Date.now() + RESUME_DELAY;
  };

  return (
    <div
      className="w-full h-full relative overflow-hidden text-white flex flex-col"
      style={{
        fontFamily: "sans-serif",
        background: "oklch(0.035 0.004 260)",
      }}
    >
      <MirrorHeader
        className="w-full relative z-10"
        style={{ background: "transparent" }}
        onBack={() => router.back()}
      />

      <div className="flex-1 min-h-0 flex flex-col items-center px-6 pt-2 pb-10 gap-6">

        {/* Skin type selector — single horizontal row, scales with viewport */}
        <div
          className="grid grid-cols-4 w-full"
          style={{
            maxWidth: "min(94vw, 1400px)",
            gap: "clamp(8px, 1.4vw, 20px)",
          }}
        >
          {SKIN_TYPES.map((key) => {
            const active = skinType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSkinType(key)}
                aria-pressed={active}
                className="rounded-2xl text-center transition-colors"
                style={{
                  padding:
                    "clamp(10px, 1.8vh, 24px) clamp(10px, 1.4vw, 24px)",
                  background: active
                    ? "rgba(79,195,247,0.14)"
                    : "rgba(255,255,255,0.04)",
                  border: active
                    ? "1.5px solid rgba(79,195,247,0.55)"
                    : "1.5px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                <div
                  className="font-semibold tracking-[0.18em] uppercase"
                  style={{
                    fontSize: "clamp(12px, 1.3vw, 19px)",
                    color: active ? "#aadeff" : "rgba(255,255,255,0.85)",
                  }}
                >
                  {SKIN_TYPE_FILTERS[key].label}
                </div>
                <div
                  className="text-white/40 mt-1 leading-snug"
                  style={{ fontSize: "clamp(9px, 0.95vw, 14px)" }}
                >
                  {SKIN_TYPE_FILTERS[key].blurb}
                </div>
              </button>
            );
          })}
        </div>

        {/* Product carousel — auto-advances, swipe/drag to browse */}
        <div
          className="w-full flex-1 min-h-0 flex flex-col justify-center gap-3"
          style={{ maxWidth: "min(94vw, 1600px)" }}
        >
          <div className="text-white/45 text-[11px] tracking-[0.24em] uppercase text-center">
            {loading
              ? "Loading products"
              : `${filtered.length} product${filtered.length === 1 ? "" : "s"} for ${SKIN_TYPE_FILTERS[skinType].label} skin`}
          </div>
          <div
            ref={scrollRef}
            className="mirror-scroll-x"
            onPointerDown={pauseAutoplay}
            onTouchStart={pauseAutoplay}
            onWheel={pauseAutoplay}
            style={
              {
                display: "flex",
                gap: 14,
                overflowX: "auto",
                overflowY: "hidden",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                scrollSnapType: "x mandatory",
                touchAction: "pan-x",
                padding: "6px 2px 14px",
                "--card": "clamp(220px, min(28vw, 42vh), 560px)",
              } as React.CSSProperties
            }
          >
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : error ? (
              <div className="w-full py-10 text-center text-white/35 text-sm">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="w-full py-10 text-center text-white/35 text-sm">
                No products available for{" "}
                {SKIN_TYPE_FILTERS[skinType].label.toLowerCase()} skin yet.
              </div>
            ) : (
              filtered.map((p) => <ProductCard key={p.id} product={p} />)
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push(ROUTES.AI_RECOMMENDATION_COSMETIC)}
        aria-label="Open AI skin analysis"
        className="fixed bottom-[104px] right-8 z-40 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl whitespace-nowrap"
        style={{
          background: "rgba(20,20,30,0.85)",
          border: "1.5px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span className="text-white/80 text-[11px] font-medium uppercase tracking-[0.18em]">
          AI Analysis
        </span>
      </button>
    </div>
  );
}
