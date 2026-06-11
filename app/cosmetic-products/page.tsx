"use client";

import { useEffect, useMemo, useState } from "react";
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
import { MarqueeColumn } from "@/modules/shared/components/MarqueeColumn";

const SKIN_TYPES = Object.keys(SKIN_TYPE_FILTERS) as SkinTypeKey[];

function ProductCard({ product }: { product: CosmeticProduct }) {
  return (
    <div
      className="flex flex-col items-center rounded-xl overflow-hidden tap-highlight-none focus:outline-none"
      style={{
        width: "100%",
        flex: "0 0 auto",
        scrollSnapAlign: "start",
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
        scrollSnapAlign: "start",
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

        {/* Side columns — swipe up/down; center stays transparent (mirror shows through) */}
        <div className="w-full flex-1 min-h-0 flex px-2">
          <div
            className="h-full min-h-0"
            style={{ flex: "0 0 28%", minWidth: 0 }}
          >
            {loading ? (
              <div className="flex flex-col" style={{ gap: 14 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="text-white/35 text-xs text-center pt-4">{error}</div>
            ) : (
              <MarqueeColumn key={`left-${skinType}`} loop={leftItems.length > 0}>
                {leftItems.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </MarqueeColumn>
            )}
          </div>

          {/* Empty center — mirror shows through */}
          <div style={{ flex: 1 }} />

          <div
            className="h-full min-h-0"
            style={{ flex: "0 0 28%", minWidth: 0 }}
          >
            {loading ? (
              <div className="flex flex-col" style={{ gap: 14 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : !error && rightItems.length === 0 ? null : (
              <MarqueeColumn key={`right-${skinType}`} loop={rightItems.length > 0}>
                {rightItems.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </MarqueeColumn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
