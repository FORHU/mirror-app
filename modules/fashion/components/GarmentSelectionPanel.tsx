"use client";

import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import { GarmentGrid } from "./GarmentGrid";
import type { SwapSlot } from "../types";

export interface GarmentSlotConfig {
  key: SwapSlot;
  label: string;
  /** Full list — used to decide whether the grid renders at all. */
  items: RemoteGarment[];
  pagedItems: RemoteGarment[];
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedId?: string;
  columns?: number;
  emptyMessage: string;
}

interface GarmentSelectionPanelProps {
  slots: GarmentSlotConfig[];
  swapSlot: SwapSlot | null;
  isProcessing: boolean;
  onCancelSwap: () => void;
  onSelect: (slot: SwapSlot, garment: RemoteGarment) => void;
}

/**
 * Right rail — the per-slot garment pickers (base/mid/outer/bottoms/shoes/bags).
 * While a swap is active only the matching slot's grid is shown. Each grid is
 * driven by a `GarmentSlotConfig`, collapsing six near-identical blocks into one.
 */
export function GarmentSelectionPanel({
  slots,
  swapSlot,
  isProcessing,
  onCancelSwap,
  onSelect,
}: GarmentSelectionPanelProps) {
  return (
    <div
      className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
      style={{ flex: "0 0 25%", width: "25%" }}
    >
      {swapSlot && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "2px",
          }}
        >
          <span
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Select replacement
          </span>
          <button
            onClick={onCancelSwap}
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "11px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {slots.map((slot) =>
        !isProcessing &&
        slot.items.length > 0 &&
        (!swapSlot || swapSlot === slot.key) ? (
          <GarmentGrid
            key={slot.key}
            label={slot.label}
            pagedItems={slot.pagedItems}
            loading={false}
            pageSize={slot.pageSize}
            currentPage={slot.currentPage}
            totalPages={slot.totalPages}
            onNext={() =>
              slot.onPageChange(
                Math.min(slot.currentPage + 1, slot.totalPages - 1),
              )
            }
            onPrev={() => slot.onPageChange(Math.max(slot.currentPage - 1, 0))}
            onPageChange={slot.onPageChange}
            selectedId={slot.selectedId}
            columns={slot.columns}
            onSelect={(g) => onSelect(slot.key, g)}
            emptyMessage={slot.emptyMessage}
          />
        ) : null,
      )}
    </div>
  );
}
