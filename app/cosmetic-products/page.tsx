"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

/** Marquee drift speed in px/s; interaction pauses it for RESUME_DELAY. */
const MARQUEE_SPEED = 26;
const RESUME_DELAY = 4500;

function ProductCard({
  product,
  onSelect,
}: {
  product: CosmeticProduct;
  onSelect?: (p: CosmeticProduct) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(product)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(product);
        }
      }}
      className="flex flex-col items-center rounded-xl overflow-hidden bg-black border border-white/[0.06] tap-highlight-none focus:outline-none"
      style={{
        width: "100%",
        flex: "0 0 auto",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        className="w-full flex items-center justify-center p-4"
        style={{ height: "clamp(110px, 15vh, 210px)" }}
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
      <div className="w-full px-3 pb-4 text-center">
        <div
          className="text-white/40 uppercase truncate tracking-[0.14em]"
          style={{ fontSize: "clamp(10px, 0.95vw, 14px)" }}
        >
          {product.brand || "Brand"}
        </div>
        <div
          className="text-white/85 font-medium leading-tight overflow-hidden mt-0.5"
          style={{
            fontSize: "clamp(13px, 1.2vw, 18px)",
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
            className="inline-block mt-2 px-3 py-0.5 rounded-full uppercase tracking-[0.14em] text-white/50 bg-white/[0.06]"
            style={{ fontSize: "clamp(9px, 0.85vw, 13px)" }}
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
        width: "100%",
        height: "clamp(180px, 24vh, 320px)",
        flex: "0 0 auto",
      }}
    />
  );
}

/**
 * Vertical column that drifts upward continuously. Content is rendered twice
 * (when `loop`) so the wrap from the end back to the start is seamless; any
 * touch/drag/wheel pauses the drift and the user can scroll freely.
 */
function MarqueeColumn({
  loop,
  children,
}: {
  loop: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loop) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Clamp dt so a backgrounded tab doesn't jump on resume.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const half = el.scrollHeight / 2;
      if (half > el.clientHeight && Date.now() >= pausedUntilRef.current) {
        el.scrollTop += MARQUEE_SPEED * dt;
        if (el.scrollTop >= half) el.scrollTop -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

  const pause = () => {
    pausedUntilRef.current = Date.now() + RESUME_DELAY;
  };

  return (
    <div
      ref={ref}
      onPointerDown={pause}
      onTouchStart={pause}
      onWheel={pause}
      className="mirror-scroll h-full"
      style={{
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <div className="flex flex-col" style={{ gap: 14, paddingBottom: 14 }}>
        <div className="flex flex-col" style={{ gap: 14 }}>
          {children}
        </div>
        {loop && (
          <div className="flex flex-col" style={{ gap: 14 }} aria-hidden>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CosmeticProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<CosmeticProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skinType, setSkinType] = useState<SkinTypeKey>("NORMAL");
  const [selected, setSelected] = useState<CosmeticProduct | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Close the enlarged view and restart the carousel when switching skin types.
  useEffect(() => {
    queueMicrotask(() => setSelected(null));
    scrollRef.current?.scrollTo({ left: 0 });
  }, [skinType]);

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

  // Alternate products between the two side columns.
  const [leftItems, rightItems] = useMemo(() => {
    const left: CosmeticProduct[] = [];
    const right: CosmeticProduct[] = [];
    filtered.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
    return [left, right];
  }, [filtered]);

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
                className="rounded-2xl text-center transition-colors tap-highlight-none focus:outline-none"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  padding: "clamp(10px, 1.8vh, 24px) clamp(10px, 1.4vw, 24px)",
                  background: "transparent",
                  border: active
                    ? "1.5px solid rgba(255,255,255,0.5)"
                    : "1.5px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                <div
                  className="font-semibold tracking-[0.18em] uppercase"
                  style={{
                    fontSize: "clamp(12px, 1.3vw, 19px)",
                    color: active ? "#ffffff" : "rgba(255,255,255,0.85)",
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

        <div className="text-white/45 text-[11px] tracking-[0.24em] uppercase text-center">
          {loading
            ? "Loading products"
            : `${filtered.length} product${filtered.length === 1 ? "" : "s"} for ${SKIN_TYPE_FILTERS[skinType].label} skin`}
        </div>

        {/* Side columns drift on their own; tap a product to inspect it center */}
        <div className="w-full flex-1 min-h-0 flex gap-4 px-2">
          <div
            className="h-full min-h-0"
            style={{ flex: "0 0 24%", minWidth: 0, maxWidth: "24%" }}
          >
            {loading ? (
              <div className="flex flex-col" style={{ gap: 14 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <MarqueeColumn
                key={`left-${skinType}`}
                loop={leftItems.length > 2}
              >
                {leftItems.map((p) => (
                  <ProductCard key={p.id} product={p} onSelect={setSelected} />
                ))}
              </MarqueeColumn>
            )}
          </div>

          {/* Center — enlarged selected product, or a hint while nothing is picked */}
          <div className="flex-1 min-w-0 h-full flex items-center justify-center">
            {error ? (
              <div className="text-white/35 text-sm text-center">{error}</div>
            ) : !loading && filtered.length === 0 ? (
              <div className="text-white/35 text-sm text-center">
                No products available for{" "}
                {SKIN_TYPE_FILTERS[skinType].label.toLowerCase()} skin yet.
              </div>
            ) : selected ? (
              <div
                className="relative flex flex-col items-center rounded-2xl bg-black border border-white/10 overflow-hidden"
                style={{
                  width: "min(92%, 680px)",
                  maxHeight: "100%",
                  padding: "clamp(16px, 2.5vw, 36px)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close product view"
                  className="absolute top-3 right-4 text-white/50 hover:text-white/90 tap-highlight-none focus:outline-none"
                  style={{
                    fontSize: "clamp(18px, 1.8vw, 26px)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  ✕
                </button>

                <div
                  className="w-full flex items-center justify-center"
                  style={{ height: "min(46vh, 520px)" }}
                >
                  {selected.fileUrl?.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.fileUrl.fileUrl}
                      alt={selected.name}
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <span className="text-white/20 text-sm uppercase tracking-widest">
                      Product
                    </span>
                  )}
                </div>

                <div className="w-full text-center mt-4">
                  <div
                    className="text-white/40 uppercase truncate tracking-[0.18em]"
                    style={{ fontSize: "clamp(13px, 1.3vw, 18px)" }}
                  >
                    {selected.brand || "Brand"}
                  </div>
                  <div
                    className="text-white/90 font-medium leading-tight mt-1"
                    style={{ fontSize: "clamp(19px, 2vw, 30px)" }}
                  >
                    {selected.name}
                  </div>
                  {selected.type && (
                    <span
                      className="inline-block mt-3 px-4 py-1.5 rounded-full uppercase tracking-[0.16em] text-white/55 bg-white/[0.06]"
                      style={{ fontSize: "clamp(11px, 1.1vw, 16px)" }}
                    >
                      {selected.type.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-white/25 text-center">
                <div
                  className="uppercase tracking-[0.3em]"
                  style={{ fontSize: "clamp(11px, 1vw, 14px)" }}
                >
                  Tap a product to view it here
                </div>
              </div>
            )}
          </div>

          <div
            className="h-full min-h-0"
            style={{ flex: "0 0 24%", minWidth: 0, maxWidth: "24%" }}
          >
            {loading ? (
              <div className="flex flex-col" style={{ gap: 14 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <MarqueeColumn
                key={`right-${skinType}`}
                loop={rightItems.length > 2}
              >
                {rightItems.map((p) => (
                  <ProductCard key={p.id} product={p} onSelect={setSelected} />
                ))}
              </MarqueeColumn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
