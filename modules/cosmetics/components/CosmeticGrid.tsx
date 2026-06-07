"use client";

import { useRef } from "react";
import type { SkinRecommendation } from "@/modules/shared/api/cosmetics.service";

function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null) return;
      const delta = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseDown: (e: React.MouseEvent) => {
      startX.current = e.clientX;
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (startX.current === null) return;
      const delta = e.clientX - startX.current;
      startX.current = null;
      if (delta < -40) onLeft();
      else if (delta > 40) onRight();
    },
    onMouseLeave: () => {
      startX.current = null;
    },
  };
}

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

function SkeletonCell({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="animate-pulse"
      style={{
        aspectRatio: "1/1",
        background: "rgba(255,255,255,0.1)",
        borderRadius: "4px",
        ...style,
      }}
    />
  );
}

export interface CosmeticGridProps {
  label: string;
  pagedItems: SkinRecommendation[];
  loading: boolean;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onNext: () => void;
  onPrev: () => void;
  onPageChange: (page: number) => void;
  columns?: number;
  selectedId?: string | null;
  onSelect: (r: SkinRecommendation) => void;
  emptyMessage: string;
  itemStyle?: React.CSSProperties;
}

export function CosmeticGrid({
  label,
  pagedItems,
  loading,
  pageSize,
  currentPage,
  totalPages,
  onNext,
  onPrev,
  onPageChange,
  columns = 2,
  selectedId,
  onSelect,
  emptyMessage,
  itemStyle,
}: CosmeticGridProps) {
  const swipeHandlers = useSwipe(onNext, onPrev);

  return (
    <div className="flex flex-col gap-1">
      <SectionTitle label={label} />
      <div
        {...swipeHandlers}
        style={{ touchAction: "pan-y", userSelect: "none", cursor: "grab" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "4px",
          }}
        >
          {loading ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <SkeletonCell key={i} style={itemStyle} />
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
                className="rounded-md overflow-hidden flex flex-col items-center justify-center p-2 bg-white/5 hover:bg-white/10 transition-colors"
                style={{
                  aspectRatio: "1/1",
                  borderRadius: "4px",
                  cursor: "pointer",
                  border:
                    selectedId === r.id
                      ? "1.5px solid rgba(255,255,255,0.6)"
                      : "1.5px solid transparent",
                  position: "relative",
                  ...itemStyle,
                }}
              >
                {/* Product Rank Badge */}
                <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-pink-500/80 rounded text-[9px] font-bold">
                  #{r.rank}
                </div>

                {/* Since we might not have reliable product images yet, we render a nice fallback box */}
                {r.cosmeticProduct.fileUrl?.fileUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.cosmeticProduct.fileUrl.fileUrl}
                    alt={r.cosmeticProduct.name}
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none mb-1"
                  />
                ) : (
                  <div className="flex-1 w-full bg-white/5 rounded flex items-center justify-center mb-1">
                    <span className="text-white/20 text-[10px] uppercase">
                      Product
                    </span>
                  </div>
                )}

                <div className="w-full text-center mt-1">
                  <div className="text-[9px] text-white/50 uppercase truncate">
                    {r.cosmeticProduct.brand || "Brand"}
                  </div>
                  <div className="text-[10px] text-white/90 font-medium leading-tight truncate">
                    {r.cosmeticProduct.name}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-center gap-1.5 pt-2">
          {Array.from({ length: Math.max(1, totalPages) }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPageChange(i)}
              aria-label={`Go to page ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentPage ? 12 : 4,
                height: 4,
                background:
                  i === currentPage ? "white" : "rgba(255,255,255,0.3)",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
