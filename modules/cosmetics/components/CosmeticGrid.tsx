"use client";

import type { SkinRecommendation } from "@/modules/shared/api/cosmetics.service";

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex-1 h-px bg-white/20" />
      <span className="text-white text-xs font-bold tracking-widest uppercase">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/20" />
    </div>
  );
}

function SkeletonCell({ fitRow = false }: { fitRow?: boolean }) {
  return (
    <div
      className={`relative animate-pulse rounded-md overflow-hidden flex flex-col items-center bg-white/[0.035] border border-white/10 ${
        fitRow ? "p-1.5" : "p-2"
      }`}
      style={{
        height: fitRow ? "100%" : undefined,
        minHeight: 0,
        aspectRatio: fitRow ? undefined : "1/1",
        borderRadius: "4px",
      }}
    >
      <div className="absolute top-1 right-1 h-4 w-6 rounded bg-pink-400/20" />
      <div
        className={`w-full flex-1 min-h-0 flex items-center justify-center ${
          fitRow ? "pb-1" : "pb-2"
        }`}
      >
        <div className="h-[72%] w-[48%] rounded bg-white/10" />
      </div>
      <div
        className={`w-full shrink-0 flex flex-col items-center gap-1 ${
          fitRow ? "min-h-[34px]" : "min-h-[46px]"
        }`}
      >
        <div className="h-2 w-10 rounded bg-white/10" />
        <div className="h-2 w-20 rounded bg-white/15" />
        <div className="h-2 w-14 rounded bg-white/10" />
      </div>
    </div>
  );
}

export interface CosmeticGridProps {
  label: string;
  pagedItems: SkinRecommendation[];
  loading: boolean;
  pageSize: number;
  columns?: number;
  selectedId?: string | null;
  onSelect: (r: SkinRecommendation) => void;
  emptyMessage: string;
}

export function CosmeticGrid({
  label,
  pagedItems,
  loading,
  pageSize,
  columns = 2,
  selectedId,
  onSelect,
  emptyMessage,
}: CosmeticGridProps) {
  const fitRows = columns === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
      <SectionTitle label={label} />
      <div
        className="min-h-0 flex-1 overflow-hidden pr-1"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: fitRows
            ? `repeat(${pageSize}, minmax(0, 1fr))`
            : undefined,
          gap: fitRows ? "6px" : "8px",
          alignContent: fitRows ? "stretch" : "start",
          overflowY: fitRows ? "hidden" : "auto",
        }}
      >
        {loading ? (
          Array.from({ length: pageSize }).map((_, i) => (
            <SkeletonCell key={i} fitRow={fitRows} />
          ))
        ) : pagedItems.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              height: "60px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.3)",
              fontSize: "12px",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: "6px",
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          pagedItems.map((r) => (
            <div
              key={r.id}
              onClick={() => onSelect(r)}
              className={`rounded-md overflow-hidden flex flex-col items-center bg-white/5 hover:bg-white/10 transition-colors ${
                fitRows ? "p-1.5" : "p-2"
              }`}
              style={{
                height: fitRows ? "100%" : "168px",
                minHeight: 0,
                borderRadius: "4px",
                cursor: "pointer",
                border:
                  selectedId === r.id
                    ? "1.5px solid rgba(255,255,255,0.6)"
                    : "1.5px solid transparent",
                position: "relative",
              }}
            >
              {/* Product Rank Badge */}
              <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-pink-500/80 rounded text-[9px] font-bold">
                #{r.rank}
              </div>

              {/* Since we might not have reliable product images yet, we render a nice fallback box */}
              {r.cosmeticProduct?.fileUrl?.fileUrl ? (
                <div
                  className={`w-full flex-1 min-h-0 flex items-center justify-center ${
                    fitRows ? "pb-1" : "pb-2"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.cosmeticProduct.fileUrl.fileUrl}
                    alt={r.cosmeticProduct?.name || "Product"}
                    draggable={false}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    style={{ filter: "none", opacity: 1 }}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 w-full bg-white/5 rounded flex items-center justify-center mb-2">
                  <span className="text-white/20 text-[10px] uppercase">
                    Product
                  </span>
                </div>
              )}

              <div
                className={`w-full shrink-0 text-center ${
                  fitRows ? "min-h-[34px]" : "min-h-[46px]"
                }`}
              >
                <div
                  className={`text-white/50 uppercase truncate px-1 ${
                    fitRows ? "text-[8px]" : "text-[9px]"
                  }`}
                >
                  {r.cosmeticProduct?.brand || "Brand"}
                </div>
                <div
                  className={`text-white/90 font-medium leading-tight px-1 overflow-hidden ${
                    fitRows ? "text-[9px]" : "text-[10px]"
                  }`}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {r.cosmeticProduct?.name || "Unknown Product"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
