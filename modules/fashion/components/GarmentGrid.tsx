"use client";

import { useRef } from "react";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";

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

export interface GarmentGridProps {
  label: string;
  pagedItems: RemoteGarment[];
  loading: boolean;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onNext: () => void;
  onPrev: () => void;
  onPageChange: (page: number) => void;
  columns?: number;
  selectedId?: string | null;
  onSelect: (g: RemoteGarment) => void;
  emptyMessage: string;
  itemStyle?: React.CSSProperties;
  horizontal?: boolean;
}

export function GarmentGrid({
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
  horizontal = false,
}: GarmentGridProps) {
  const swipeHandlers = useSwipe(onNext, onPrev);

  // Tile size scales with the viewport; rows double up when there are
  // enough items so the panel doesn't trail off into empty space.
  const tileVar = {
    "--tile": "clamp(80px, 8.5vw, 132px)",
  } as React.CSSProperties;
  const rowCount = loading || pagedItems.length > 3 ? 2 : 1;

  return (
    <div className="flex flex-col gap-1">
      <SectionTitle label={label} />
      <div
        {...swipeHandlers}
        className={horizontal ? "mirror-scroll-x" : undefined}
        style={{
          touchAction: horizontal ? "pan-x pan-y" : "pan-y",
          userSelect: "none",
          cursor: horizontal ? "default" : "grab",
          overflowX: horizontal ? "auto" : "visible",
          overflowY: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollSnapType: horizontal ? "x mandatory" : undefined,
        }}
      >
        <div
          style={
            horizontal
              ? {
                  display: "grid",
                  gridAutoFlow: "column",
                  gridTemplateRows: `repeat(${rowCount}, max-content)`,
                  gap: "10px",
                  alignItems: "center",
                  width: "max-content",
                  ...tileVar,
                }
              : {
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: "4px",
                }
          }
        >
          {loading ? (
            Array.from({ length: Math.max(2, Math.min(pageSize, 4)) }).map(
              (_, i) => (
                <SkeletonCell
                  key={i}
                  style={{
                    width: horizontal ? "var(--tile)" : undefined,
                    height: horizontal ? "calc(var(--tile) * 1.2)" : undefined,
                    ...itemStyle,
                  }}
                />
              ),
            )
          ) : pagedItems.length === 0 ? (
            <div
              style={{
                gridColumn: horizontal ? undefined : "1 / -1",
                minWidth: horizontal ? "calc(var(--tile) * 2.5)" : undefined,
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
            pagedItems.map((g) => (
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedId === g.id}
                onClick={() => onSelect(g)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
                className="rounded-md overflow-hidden flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                style={{
                  aspectRatio: "1/1",
                  width: horizontal ? "var(--tile)" : undefined,
                  height: horizontal ? "calc(var(--tile) * 1.2)" : undefined,
                  scrollSnapAlign: horizontal ? "start" : undefined,
                  borderRadius: "4px",
                  cursor: "pointer",
                  border:
                    selectedId === g.id
                      ? "1.5px solid rgba(255,255,255,0.6)"
                      : "1.5px solid transparent",
                  ...itemStyle,
                }}
              >
                {g.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.imageUrl}
                    alt={g.name}
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5 pt-2">
            {Array.from({ length: totalPages }).map((_, i) => (
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
        )}
      </div>
    </div>
  );
}
