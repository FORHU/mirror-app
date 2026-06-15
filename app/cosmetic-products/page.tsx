"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MirrorHeader from "@/components/MirrorHeader";
import {
  cosmeticsService,
  type CosmeticProduct,
  type SkinAnalysis,
} from "@/modules/shared/api/cosmetics.service";
import {
  COSMETIC_EVALUATE_KEY,
  SKIN_TYPE_FILTERS,
  matchesSkinType,
  type SkinTypeKey,
} from "@/modules/cosmetics/constants";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useCaptureFrame } from "@/components/ProximitySensorMount";
import { listenForSkinAnalysis } from "@/modules/shared/api/skinAnalysisSocket";
import { ROUTES } from "@/navigation";

const SKIN_TYPES = Object.keys(SKIN_TYPE_FILTERS) as SkinTypeKey[];
const API_LIMIT = 100;
// Products shown per scroll page; the user pages explicitly past this cap.
const PAGE_SIZE = 20;

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

const ProductCard = memo(function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: CosmeticProduct;
  selected: boolean;
  onSelect: (productId: string) => void;
}) {
  const handleSelect = useCallback(() => {
    onSelect(product.id);
  }, [onSelect, product.id]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      className="flex flex-col items-center rounded-xl overflow-hidden tap-highlight-none focus:outline-none"
      style={{
        width: "100%",
        flex: "0 0 auto",
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
});
ProductCard.displayName = "ProductCard";

const SkeletonCard = memo(function SkeletonCard() {
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
});
SkeletonCard.displayName = "SkeletonCard";

const COLUMN_SCROLL_STYLE = {
  overflowY: "auto" as const,
  touchAction: "pan-y" as const,
  scrollbarWidth: "none" as const,
};

export default function CosmeticProductsPage() {
  const router = useRouter();
  const captureFrame = useCaptureFrame();
  const isPresent = useMirrorStore((s) => s.isPresent);
  const sensorStatus = useMirrorStore((s) => s.sensorStatus);

  const [apiProducts, setApiProducts] = useState<CosmeticProduct[]>([]);
  const [isLoadingFirst, setIsLoadingFirst] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side pagination over the loaded products (cap PAGE_SIZE per page).
  const [displayPage, setDisplayPage] = useState(1);
  // Refs for the two scroll columns so scrolling one mirrors the other.
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const rightColRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScroll = useRef(false);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  // Camera gating: a real video device must exist (enumerateDevices), the
  // proximity sensor must not have failed, AND a face must currently be
  // present. Only then do we treat the camera as usable for live analysis.
  const [hasVideoInput, setHasVideoInput] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const cameraDetected =
    hasVideoInput && sensorStatus !== "unavailable" && isPresent;

  // Load page 1 on mount
  useEffect(() => {
    let cancelled = false;
    cosmeticsService
      .getPage(1, API_LIMIT)
      .then((first) => {
        if (cancelled) return;
        setApiProducts(first.items);
        setHasMore(first.hasMore);
        setIsLoadingFirst(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load products");
          setIsLoadingFirst(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch when nextPage advances past 2
  useEffect(() => {
    if (nextPage < 3 || isLoadingFirst) return;
    let cancelled = false;
    cosmeticsService
      .getPage(nextPage - 1, API_LIMIT)
      .then((next) => {
        if (cancelled) return;
        setApiProducts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...next.items.filter((p) => !ids.has(p.id))];
        });
        setHasMore(next.hasMore);
        setIsLoadingMore(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nextPage, isLoadingFirst]);

  // The skin-type tabs are now action buttons (mock-evaluate triggers), not
  // catalog filters, so the browse grid shows every loaded product.
  const filtered = apiProducts;

  // Detect whether the device actually has a camera (videoinput). Combined with
  // the proximity sensor status + presence to decide if live analysis is usable.
  useEffect(() => {
    let cancelled = false;
    const md =
      typeof navigator !== "undefined" ? navigator.mediaDevices : null;
    // hasVideoInput defaults to false, so no synchronous setState is needed
    // here — just bail when the API is unavailable.
    if (!md?.enumerateDevices) return;
    const check = () => {
      md.enumerateDevices()
        .then((devices) => {
          if (!cancelled) {
            setHasVideoInput(devices.some((d) => d.kind === "videoinput"));
          }
        })
        .catch(() => {
          if (!cancelled) setHasVideoInput(false);
        });
    };
    check();
    md.addEventListener?.("devicechange", check);
    return () => {
      cancelled = true;
      md.removeEventListener?.("devicechange", check);
    };
  }, []);

  const totalLoadedPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const canPrev = displayPage > 1;
  const canNext = displayPage < totalLoadedPages || hasMore;

  // Only the current page's slice is shown in the scroll columns.
  const pageItems = useMemo(
    () =>
      filtered.slice((displayPage - 1) * PAGE_SIZE, displayPage * PAGE_SIZE),
    [filtered, displayPage],
  );

  const leftItems = useMemo(
    () => pageItems.filter((_, i) => i % 2 === 0),
    [pageItems],
  );
  const rightItems = useMemo(
    () => pageItems.filter((_, i) => i % 2 !== 0),
    [pageItems],
  );

  const goPrev = useCallback(
    () => setDisplayPage((p) => Math.max(1, p - 1)),
    [],
  );

  // Advance a page, loading another API page first when the upcoming page isn't
  // fully loaded yet (so "Next" always has products ready).
  const goNext = useCallback(() => {
    if (
      hasMore &&
      !isLoadingMore &&
      !isLoadingFirst &&
      filtered.length < (displayPage + 2) * PAGE_SIZE
    ) {
      setIsLoadingMore(true);
      setNextPage((p) => p + 1);
    }
    setDisplayPage((p) => p + 1);
  }, [hasMore, isLoadingMore, isLoadingFirst, filtered.length, displayPage]);

  // Reset both columns to the top whenever the page changes.
  useEffect(() => {
    if (leftColRef.current) leftColRef.current.scrollTop = 0;
    if (rightColRef.current) rightColRef.current.scrollTop = 0;
  }, [displayPage]);

  // Mirror one column's scroll position onto the other.
  const handleColumnScroll = useCallback((source: "left" | "right") => {
    if (isSyncingScroll.current) return;
    const src = source === "left" ? leftColRef.current : rightColRef.current;
    const dst = source === "left" ? rightColRef.current : leftColRef.current;
    if (!src || !dst) return;
    isSyncingScroll.current = true;
    dst.scrollTop = src.scrollTop;
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, []);

  const selectedProduct = useMemo(
    () => filtered.find((p) => p.id === selectedProductId) ?? null,
    [filtered, selectedProductId],
  );
  const selectedProductExplanation = selectedProduct
    ? getProductExplanation(selectedProduct)
    : null;

  // Mock path (no camera): clicking a skin-type button immediately builds a
  // synthetic SkinAnalysis for that type and jumps to the recommendations.
  const evaluateMock = useCallback(
    (key: SkinTypeKey) => {
      const recommendations = recommendationPool(
        apiProducts.filter((p) => matchesSkinType(p, key)),
      )
        .slice(0, 10)
        .map((product, index) => ({
          id: `catalog-${key.toLowerCase()}-${product.id}`,
          rank: index + 1,
          score: Math.max(0.7, 1 - index * 0.03),
          reason:
            getProductExplanation(product) ??
            `Recommended for ${SKIN_TYPE_FILTERS[key].label.toLowerCase()} skin.`,
          cosmeticProduct: product,
        }));
      const result: SkinAnalysis = {
        id: `catalog-evaluation-${key.toLowerCase()}`,
        skinType: key,
        skinTone: null,
        hydrationPct: key === "DRY" ? 32 : key === "OILY" ? 68 : 52,
        oilinessPct: key === "OILY" ? 78 : key === "DRY" ? 24 : 48,
        concerns: [SKIN_TYPE_FILTERS[key].label],
        routineTip: `Showing recommendations for ${SKIN_TYPE_FILTERS[key].label.toLowerCase()} skin.`,
        recommendations,
      };

      useMirrorStore.getState().setPendingCosmeticsData(null);
      useMirrorStore.getState().setChatCosmeticsData(null);
      useMirrorStore.getState().setSkinAnalysisResult(result);
      sessionStorage.setItem(COSMETIC_EVALUATE_KEY, "1");
      router.push(ROUTES.AI_RECOMMENDATION_COSMETIC);
    },
    [apiProducts, router],
  );

  // Skin-type button handler — disabled (no-op) while a live camera is detected.
  const handleSkinTypeClick = useCallback(
    (key: SkinTypeKey) => {
      if (cameraDetected || apiProducts.length === 0) return;
      evaluateMock(key);
    },
    [cameraDetected, apiProducts.length, evaluateMock],
  );

  const handleProductSelect = useCallback(
    (productId: string) => {
      setSelectedProductId((curr) => {
        const isDeselecting = curr === productId;
        const store = useMirrorStore.getState();
        const currentSnapshot = store.overviewCosmeticsSnapshot || [];

        if (isDeselecting) {
          // Remove from overview if deselected
          const newSnapshot = currentSnapshot.filter((c) => c.id !== productId);
          store.setOverviewCosmeticsSnapshot(
            newSnapshot.length > 0 ? newSnapshot : null,
          );
        } else {
          // Add to overview if not already there
          const product = apiProducts.find((p) => p.id === productId);
          if (product && !currentSnapshot.find((c) => c.id === product.id)) {
            store.setOverviewCosmeticsSnapshot([
              ...currentSnapshot,
              {
                id: product.id,
                name: product.name,
                imageUrl: product.fileUrl?.fileUrl ?? "",
                brand: product.brand ?? undefined,
              },
            ]);
          }
        }
        return isDeselecting ? null : productId;
      });
    },
    [apiProducts],
  );

  // Real path (camera detected): capture a fresh frame, upload it, kick off the
  // backend analysis, and wait for the Socket.io result before navigating.
  const handleEvaluateSkin = useCallback(async () => {
    if (!cameraDetected || isAnalyzing) return;

    const dataUrl = captureFrame();
    if (!dataUrl) {
      setAnalysisError("Couldn't capture from the camera — please try again.");
      return;
    }

    setAnalysisError(null);
    setIsAnalyzing(true);
    useMirrorStore.getState().setSkinCaptureUrl(dataUrl);
    useMirrorStore.getState().setPendingCosmeticsData(null);
    useMirrorStore.getState().setChatCosmeticsData(null);

    let unsubscribe = () => {};
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubscribe();
      window.clearTimeout(timeout);
    };
    const timeout = window.setTimeout(() => {
      finish();
      setIsAnalyzing(false);
      setAnalysisError("Analysis timed out — please try again.");
    }, 45_000);

    try {
      // Subscribe BEFORE starting so the push can't race ahead of us.
      unsubscribe = await listenForSkinAnalysis({
        onComplete: (data) => {
          finish();
          useMirrorStore.getState().setSkinAnalysisResult(data as SkinAnalysis);
          sessionStorage.setItem(COSMETIC_EVALUATE_KEY, "1");
          router.push(ROUTES.AI_RECOMMENDATION_COSMETIC);
        },
        onError: (message) => {
          finish();
          setIsAnalyzing(false);
          setAnalysisError(message || "Skin analysis failed — please try again.");
        },
      });

      const { id: fileId } = await cosmeticsService.uploadCapture(dataUrl);
      await cosmeticsService.startSkinAnalysis(fileId);
    } catch (err) {
      finish();
      setIsAnalyzing(false);
      setAnalysisError(
        err instanceof Error ? err.message : "Skin analysis failed — please try again.",
      );
    }
  }, [cameraDetected, isAnalyzing, captureFrame, router]);

  const isInitialLoading = isLoadingFirst && apiProducts.length === 0;

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
        {/* Skin type buttons — disabled while a live camera is detected
            (use "Evaluate Your Skin" instead); when no camera is present each
            one triggers a mock evaluation for that skin type. */}
        <div
          className="grid grid-cols-4 w-full"
          style={{
            maxWidth: "min(94vw, 1400px)",
            gap: "clamp(8px, 1.4vw, 20px)",
          }}
        >
          {SKIN_TYPES.map((key) => {
            const disabled = cameraDetected || isInitialLoading;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSkinTypeClick(key)}
                disabled={disabled}
                aria-disabled={disabled}
                className="rounded-2xl text-center transition-colors tap-highlight-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  padding: "clamp(10px, 1.8vh, 24px) clamp(10px, 1.4vw, 24px)",
                  background: "transparent",
                  border: "1.5px solid rgba(255,255,255,0.1)",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <div
                  className="font-semibold tracking-[0.18em] uppercase"
                  style={{
                    fontSize: "clamp(12px, 1.3vw, 19px)",
                    color: "rgba(255,255,255,0.85)",
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
          disabled={!cameraDetected || isAnalyzing}
          className="rounded-2xl text-center transition-colors tap-highlight-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            WebkitTapHighlightColor: "transparent",
            padding: "clamp(10px, 1.5vh, 18px) clamp(22px, 3vw, 44px)",
            background: "transparent",
            border: "1.5px solid rgba(255,255,255,0.5)",
            color: "#ffffff",
            cursor: !cameraDetected || isAnalyzing ? "not-allowed" : "pointer",
          }}
        >
          <span className="font-semibold tracking-[0.18em] uppercase text-[12px]">
            {isAnalyzing ? "Analyzing…" : "Evaluate Your Skin"}
          </span>
        </button>

        <div className="text-white/45 text-[11px] tracking-[0.24em] uppercase text-center">
          {isInitialLoading
            ? "Loading products…"
            : error
              ? error
              : analysisError
                ? analysisError
                : cameraDetected
                  ? "Camera detected — tap “Evaluate Your Skin” for a live analysis"
                  : "No camera detected — tap a skin type to see recommendations"}
        </div>

        {/* Product columns */}
        <div className="w-full flex-1 min-h-0 flex px-2">
          {/* Left column */}
          <div
            ref={leftColRef}
            onScroll={() => handleColumnScroll("left")}
            className="h-full min-h-0 flex flex-col gap-3"
            style={{ flex: "0 0 28%", minWidth: 0, ...COLUMN_SCROLL_STYLE }}
          >
            {isInitialLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : leftItems.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedProductId === p.id}
                    onSelect={handleProductSelect}
                  />
                ))}
          </div>

          {/* Center — selected product detail */}
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

          {/* Right column */}
          <div
            ref={rightColRef}
            onScroll={() => handleColumnScroll("right")}
            className="h-full min-h-0 flex flex-col gap-3"
            style={{ flex: "0 0 28%", minWidth: 0, ...COLUMN_SCROLL_STYLE }}
          >
            {isInitialLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : rightItems.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    selected={selectedProductId === p.id}
                    onSelect={handleProductSelect}
                  />
                ))}
          </div>
        </div>

        {/* Pagination — shown once products load; pages through PAGE_SIZE at a time */}
        {!isInitialLoading && filtered.length > 0 && (
          <div className="flex items-center justify-center gap-5 py-3 shrink-0 select-none">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.12em] border transition-opacity disabled:opacity-30"
              style={{
                color: "rgba(255,255,255,0.7)",
                borderColor: "rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.04)",
                cursor: canPrev ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Prev
            </button>
            <span className="text-white/55 text-xs tracking-[0.14em]">
              Page {displayPage}
              {hasMore || isLoadingMore ? "" : ` / ${totalLoadedPages}`}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.12em] border transition-opacity disabled:opacity-30"
              style={{
                color: "rgba(255,255,255,0.7)",
                borderColor: "rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.04)",
                cursor: canNext ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {isLoadingMore && !canPrev ? "Loading…" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
