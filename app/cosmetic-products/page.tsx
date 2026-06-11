"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MirrorHeader from "@/components/MirrorHeader";
import {
  cosmeticsService,
  type CosmeticProduct,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import {
  SKIN_TYPE_FILTERS,
  matchesSkinType,
  type SkinTypeKey,
} from "@/modules/cosmetics/constants";
import { MarqueeColumn } from "@/modules/shared/components/MarqueeColumn";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { ROUTES } from "@/navigation";

const SKIN_TYPES = Object.keys(SKIN_TYPE_FILTERS) as SkinTypeKey[];

type CosmeticMetadata = Record<string, unknown> | null | undefined;

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function prettyText(value: string) {
  return value.replace(/_/g, " ").trim();
}

function getMetadata(product: CosmeticProduct): CosmeticMetadata {
  const source = product as CosmeticProduct & {
    metadata?: CosmeticMetadata;
    metaData?: CosmeticMetadata;
  };
  return source.metadata ?? source.metaData;
}

function getProductExplanation(product: CosmeticProduct) {
  const source = product as CosmeticProduct & {
    why?: string | null;
    reason?: string | null;
    explanation?: string | null;
    skin_type_verdict?: string | null;
    skinTypeVerdict?: string | null;
  };
  const metadata = getMetadata(product);
  const explicit = firstText(
    source.why,
    source.reason,
    source.explanation,
    metadata?.why,
    metadata?.reason,
    metadata?.explanation,
  );
  if (explicit) return explicit;

  const category = firstText(product.category, product.type);
  const benefit = firstText(...product.benefits);
  const tag = firstText(...product.tags);
  const skinVerdict = firstText(
    source.skin_type_verdict,
    source.skinTypeVerdict,
    metadata?.skin_type_verdict,
    metadata?.skinTypeVerdict,
  );

  if (category && benefit && tag) {
    return `It has ${prettyText(benefit)} benefits and works well as ${prettyText(tag)}.`;
  }
  if (category && benefit) {
    return `It has ${prettyText(benefit)} benefits.`;
  }
  if (category && skinVerdict) {
    return `It has a ${prettyText(skinVerdict)} skin-type match.`;
  }
  if (category) return null;
  return null;
}

function recommendationPool(items: CosmeticProduct[]) {
  const buckets = new Map<string, CosmeticProduct[]>();
  for (const item of items) {
    const key = item.type ?? item.category ?? "OTHER";
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }

  const mixed: CosmeticProduct[] = [];
  const bucketItems = Array.from(buckets.values());
  let offset = 1;
  while (mixed.length < items.length) {
    let added = false;
    for (const bucket of bucketItems) {
      const item = bucket[offset % bucket.length];
      if (item && !mixed.some((candidate) => candidate.id === item.id)) {
        mixed.push(item);
        added = true;
      }
    }
    if (!added) break;
    offset += 1;
  }

  return mixed.length ? mixed : items;
}

function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: CosmeticProduct;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="flex flex-col items-center rounded-xl overflow-hidden tap-highlight-none focus:outline-none"
      style={{
        width: "100%",
        flex: "0 0 auto",
        scrollSnapAlign: "start",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
        border: selected
          ? "1.5px solid rgba(255,255,255,0.55)"
          : "1.5px solid transparent",
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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

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
  const selectedProduct = useMemo(
    () => filtered.find((p) => p.id === selectedProductId) ?? null,
    [filtered, selectedProductId],
  );
  const selectedProductExplanation = selectedProduct
    ? getProductExplanation(selectedProduct)
    : null;

  // Alternate products between the two side columns.
  const [leftItems, rightItems] = useMemo(() => {
    const left: CosmeticProduct[] = [];
    const right: CosmeticProduct[] = [];
    filtered.forEach((p, i) => (i % 2 === 0 ? left : right).push(p));
    return [left, right];
  }, [filtered]);

  const handleEvaluateSkin = () => {
    const evaluation = {
      success: true,
      skin_type: skinType,
    };
    const recommendations = recommendationPool(filtered)
      .slice(0, 10)
      .map((product, index) => ({
      id: `catalog-${skinType.toLowerCase()}-${product.id}`,
      rank: index + 1,
      score: Math.max(0.7, 1 - index * 0.03),
      reason:
        getProductExplanation(product) ??
        `Recommended for ${SKIN_TYPE_FILTERS[skinType].label.toLowerCase()} skin.`,
      cosmeticProduct: product,
      }));
    const result: SkinAnalysis = {
      id: `catalog-evaluation-${skinType.toLowerCase()}`,
      skinType: evaluation.skin_type,
      skinTone: null,
      hydrationPct: skinType === "DRY" ? 32 : skinType === "OILY" ? 68 : 52,
      oilinessPct: skinType === "OILY" ? 78 : skinType === "DRY" ? 24 : 48,
      concerns: [SKIN_TYPE_FILTERS[skinType].label],
      routineTip: `Showing recommendations for ${SKIN_TYPE_FILTERS[skinType].label.toLowerCase()} skin.`,
      recommendations,
    };

    useMirrorStore.getState().setPendingCosmeticsData(null);
    useMirrorStore.getState().setChatCosmeticsData(null);
    useMirrorStore.getState().setSkinAnalysisResult(result);
    useMirrorStore
      .getState()
      .setAiSuggestion(
        `Skin evaluation complete: ${SKIN_TYPE_FILTERS[skinType].label} skin.`,
      );
    router.push(ROUTES.AI_RECOMMENDATION_COSMETIC);
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
                onClick={() => {
                  setSkinType(key);
                  setSelectedProductId(null);
                }}
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

        <button
          type="button"
          onClick={handleEvaluateSkin}
          disabled={loading || filtered.length === 0}
          className="rounded-2xl text-center transition-colors tap-highlight-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            WebkitTapHighlightColor: "transparent",
            padding: "clamp(10px, 1.5vh, 18px) clamp(22px, 3vw, 44px)",
            background: "transparent",
            border: "1.5px solid rgba(255,255,255,0.5)",
            color: "#ffffff",
            cursor: loading || filtered.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          <span className="font-semibold tracking-[0.18em] uppercase text-[12px]">
            Evaluate Your Skin
          </span>
        </button>

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
              <div className="text-white/35 text-xs text-center pt-4">
                {error}
              </div>
            ) : (
              <MarqueeColumn
                key={`left-${skinType}`}
                loop={false}
                style={{ scrollSnapType: "y mandatory" }}
              >
                {leftItems.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedProductId === p.id}
                    onSelect={() =>
                      setSelectedProductId((current) =>
                        current === p.id ? null : p.id,
                      )
                    }
                  />
                ))}
              </MarqueeColumn>
            )}
          </div>

          <div
            className="h-full min-h-0 flex items-center justify-center px-6"
            style={{ flex: 1, minWidth: 0 }}
          >
            {selectedProduct && (
              <div className="w-full h-full flex flex-col items-center justify-center text-center">
                <div
                  className="w-full flex items-center justify-center"
                  style={{ height: "min(58vh, 520px)" }}
                >
                  {selectedProduct.fileUrl?.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedProduct.fileUrl.fileUrl}
                      alt={selectedProduct.name}
                      draggable={false}
                      className="max-w-full max-h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <span className="text-white/25 text-xs uppercase tracking-[0.18em]">
                      Product
                    </span>
                  )}
                </div>
                <div className="mt-4 text-white/45 uppercase tracking-[0.18em] text-xs">
                  {selectedProduct.brand || "Brand"}
                </div>
                <div className="mt-1 max-w-[520px] text-white font-semibold leading-tight text-2xl">
                  {selectedProduct.name}
                </div>
                {selectedProduct.type && (
                  <div className="mt-3 text-white/50 uppercase tracking-[0.16em] text-[11px]">
                    {selectedProduct.type.replace(/_/g, " ")}
                  </div>
                )}
                {selectedProductExplanation && (
                  <div className="mt-4 max-w-[560px] text-white text-sm leading-relaxed">
                    {selectedProductExplanation}
                  </div>
                )}
              </div>
            )}
          </div>

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
              <MarqueeColumn
                key={`right-${skinType}`}
                loop={false}
                style={{ scrollSnapType: "y mandatory" }}
              >
                {rightItems.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedProductId === p.id}
                    onSelect={() =>
                      setSelectedProductId((current) =>
                        current === p.id ? null : p.id,
                      )
                    }
                  />
                ))}
              </MarqueeColumn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
