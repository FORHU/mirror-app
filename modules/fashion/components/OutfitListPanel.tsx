"use client";

import type { RemoteOutfit } from "@/modules/shared/api/outfit.service";
import type { useSwipe } from "../hooks/useSwipe";
import { SectionTitle } from "./SectionTitle";

interface OutfitListPanelProps {
  outfits: RemoteOutfit[];
  pagedOutfits: RemoteOutfit[];
  outfitPage: number;
  outfitPageSize: number;
  totalOutfitPages: number;
  selectedOutfitIdx: number | null;
  isProcessing: boolean;
  swipeHandlers: ReturnType<typeof useSwipe>;
  onSelect: (idx: number) => void;
  onPageChange: (page: number) => void;
}

/** Left rail — paged list of recommended outfits with swipe + page dots. */
export function OutfitListPanel({
  outfits,
  pagedOutfits,
  outfitPage,
  outfitPageSize,
  totalOutfitPages,
  selectedOutfitIdx,
  isProcessing,
  swipeHandlers,
  onSelect,
  onPageChange,
}: OutfitListPanelProps) {
  return (
    <div
      className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
      style={{ flex: "0 0 25%", width: "25%" }}
    >
      <div
        className="flex flex-col gap-1"
        style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        {!isProcessing ? null : outfits.length === 0 ? (
          <SectionTitle label="Outfit" />
        ) : null}
        <div
          {...swipeHandlers}
          style={{
            touchAction: "pan-y",
            userSelect: "none",
            cursor: "grab",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(1, 1fr)",
              gridTemplateRows: "repeat(4, 1fr)",
              gap: "6px",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {isProcessing
              ? null
              : outfits.length === 0
                ? null
                : pagedOutfits.map((outfit, i) => {
                    const globalIdx = outfitPage * outfitPageSize + i;
                    return (
                      <div
                        key={outfit.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Outfit ${globalIdx + 1}`}
                        onClick={() => onSelect(globalIdx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}
                        style={{
                          position: "relative",
                          borderRadius: "10px",
                          overflow: "hidden",
                          background: "transparent",
                          cursor: "pointer",
                          border:
                            selectedOutfitIdx === globalIdx
                              ? "2px solid rgba(255,255,255,0.6)"
                              : "2px solid transparent",
                          transition: "border-color 0.2s",
                        }}
                      >
                        {outfit.file?.fileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={outfit.file.fileUrl}
                            alt={outfit.name}
                            draggable={false}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        ) : (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                color: "rgba(255,255,255,0.2)",
                                fontSize: "11px",
                              }}
                            >
                              {outfit.name}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
          </div>
          {!isProcessing && (
            <div className="flex justify-center gap-1.5 pt-2">
              {Array.from({ length: totalOutfitPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPageChange(i)}
                  style={{
                    width: i === outfitPage ? 12 : 4,
                    height: 4,
                    borderRadius: "9999px",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    background:
                      i === outfitPage ? "white" : "rgba(255,255,255,0.3)",
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
