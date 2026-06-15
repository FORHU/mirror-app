"use client";

import type { SkinRecommendation } from "@/modules/shared/api/cosmetics.service";

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="px-1 py-1">
      <span className="text-white/55 text-[11px] font-semibold tracking-[0.28em] uppercase">
        {label}
      </span>
    </div>
  );
}

export interface CosmeticGridProps {
  label?: string;
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
      {label && <SectionTitle label={label} />}
      <div
        className="min-h-0 flex-1 overflow-hidden pr-1"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: fitRows
            ? `repeat(${pageSize}, minmax(0, 1fr))`
            : undefined,
          gap: fitRows ? "10px" : "8px",
          alignContent: fitRows ? "stretch" : "start",
          overflowY: fitRows ? "hidden" : "auto",
        }}
      >
        {loading ? null : pagedItems.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              height: "60px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.24)",
              fontSize: "12px",
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          pagedItems.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedId === r.id}
              aria-label={`${r.cosmeticProduct?.name || "Product"}${
                r.cosmeticProduct?.brand ? `, ${r.cosmeticProduct.brand}` : ""
              } — rank ${r.rank}`}
              onClick={() => onSelect(r)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(r);
                }
              }}
              className={`rounded-md overflow-hidden flex flex-col items-center bg-white/[0.015] hover:bg-white/[0.035] transition-colors focus:outline-none focus-visible:ring-0 ${
                fitRows ? "p-1" : "p-2"
              }`}
              style={{
                height: fitRows ? "100%" : "168px",
                minHeight: 0,
                borderRadius: "6px",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {r.cosmeticProduct?.fileUrl?.fileUrl ? (
                <div
                  className={`w-full flex-1 min-h-0 flex items-center justify-center ${
                    fitRows ? "pb-0.5" : "pb-2"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.cosmeticProduct.fileUrl.fileUrl}
                    alt={r.cosmeticProduct?.name || "Product"}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    style={{ filter: "none", opacity: 1 }}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 w-full bg-white/[0.025] rounded flex items-center justify-center mb-2">
                  <span className="text-white/20 text-[10px] uppercase">
                    Product
                  </span>
                </div>
              )}

              <div
                className={`w-full shrink-0 text-center ${
                  fitRows ? "min-h-[30px]" : "min-h-[52px]"
                }`}
              >
                <div className="text-white/40 uppercase truncate px-1 text-[10px] tracking-[0.12em]">
                  {r.cosmeticProduct?.brand || "Brand"}
                </div>
                <div
                  className={`text-white/75 font-medium leading-tight px-1 overflow-hidden ${
                    fitRows ? "text-[12px]" : "text-[13px]"
                  }`}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: fitRows ? 1 : 2,
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
