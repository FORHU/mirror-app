"use client";

import { PanelRightClose, PanelRightOpen, Shirt } from "lucide-react";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import { GarmentGrid } from "./GarmentGrid";
import type { SwapSlot } from "../types";

export interface GarmentSlotConfig {
  key: SwapSlot;
  label: string;
  /** Full list - used for the expanded drawer. */
  items: RemoteGarment[];
  pagedItems: RemoteGarment[];
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedId?: string;
  columns?: number;
  loading?: boolean;
  emptyMessage: string;
}

interface GarmentSelectionPanelProps {
  slots: GarmentSlotConfig[];
  swapSlot: SwapSlot | null;
  isProcessing: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelSwap: () => void;
  onSelect: (slot: SwapSlot, garment: RemoteGarment) => void;
}

/**
 * Right rail - per-slot garment pickers. When collapsed, it becomes a narrow
 * handle so the outfit details can claim the freed space.
 */
export function GarmentSelectionPanel({
  slots,
  swapSlot,
  isProcessing,
  isOpen,
  onOpenChange,
  onCancelSwap,
  onSelect,
}: GarmentSelectionPanelProps) {
  const visibleSlots = slots.filter(
    (slot) =>
      !isProcessing &&
      (slot.loading || slot.items.length > 0) &&
      (!swapSlot || swapSlot === slot.key),
  );
  const ignorePaging = () => undefined;

  return (
    <div
      className="h-full flex flex-col min-h-0 overflow-hidden"
      style={{
        flex: isOpen ? "0 0 25%" : "0 0 56px",
        width: isOpen ? "25%" : "56px",
        padding: isOpen ? "8px 8px 8px 4px" : "8px 6px",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        background: isOpen ? "rgba(7,7,12,0.28)" : "rgba(7,7,12,0.18)",
      }}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        title={isOpen ? "Hide garments" : "Show garments"}
        aria-label={isOpen ? "Hide garments" : "Show garments"}
        aria-expanded={isOpen}
        className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        style={{
          width: isOpen ? "100%" : 44,
          height: 44,
          flexShrink: 0,
          gap: 8,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(20,20,30,0.72)",
          color: "rgba(255,255,255,0.82)",
          cursor: "pointer",
        }}
      >
        {isOpen ? (
          <PanelRightClose className="h-4 w-4" />
        ) : (
          <PanelRightOpen className="h-4 w-4" />
        )}
        {isOpen && (
          <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
            Garments
          </span>
        )}
      </button>

      {!isOpen && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          title="Show garments"
          aria-label="Show garments"
          className="mt-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{
            minHeight: 0,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer",
          }}
        >
          <Shirt className="h-4 w-4" />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Garments
          </span>
        </button>
      )}

      {isOpen && swapSlot && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 2px 2px",
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
            type="button"
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
            x
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="flex flex-col gap-3 pt-2 mirror-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            paddingRight: 2,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {visibleSlots.map((slot) => (
            <GarmentGrid
              key={slot.key}
              label={slot.label}
              pagedItems={slot.items}
              loading={Boolean(slot.loading)}
              pageSize={slot.items.length}
              currentPage={0}
              totalPages={1}
              onNext={ignorePaging}
              onPrev={ignorePaging}
              onPageChange={ignorePaging}
              selectedId={slot.selectedId}
              columns={slot.columns}
              onSelect={(g) => onSelect(slot.key, g)}
              emptyMessage={slot.emptyMessage}
              horizontal
            />
          ))}
        </div>
      )}
    </div>
  );
}
