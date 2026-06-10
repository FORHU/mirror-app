"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MirrorHeader from "@/components/MirrorHeader";
import { QuoteCarousel } from "@/components/QuoteCarousel";
import { WardrobeFormModal } from "@/modules/fashion/components/WardrobeFormModal";
import {
  GarmentSelectionPanel,
  type GarmentSlotConfig,
} from "@/modules/fashion/components/GarmentSelectionPanel";
import {
  garmentService,
  type RemoteGarment,
} from "@/modules/shared/api/garment.service";
import { FittingSlot } from "@/modules/garment/types";
import type { SwapSlot } from "@/modules/fashion/types";
import { FASHION_QUOTES } from "@/modules/fashion/constants";

const SLOT_LABELS: Record<SwapSlot, string> = {
  base: "Base Top",
  mid: "Mid Layer",
  outer: "Outer Layer",
  bottoms: "Bottoms",
  shoes: "Shoes",
  bags: "Bag",
};

const SLOTS: SwapSlot[] = ["base", "mid", "outer", "bottoms", "shoes", "bags"];
const ROW_GAP = 6;

/** Left panel — slot image thumbnails + Generate Wardrobe button. */
function WardrobeLeftPanel({
  selected,
  hasAnySelection,
  onClearSlot,
  onGenerate,
}: {
  selected: Record<SwapSlot, RemoteGarment | null>;
  hasAnySelection: boolean;
  onClearSlot: (slot: SwapSlot) => void;
  onGenerate: () => void;
}) {
  return (
    <div
      className="h-full flex flex-col min-h-0"
      style={{
        flex: "0 0 25%",
        width: "25%",
        padding: "0 8px 12px 12px",
        gap: ROW_GAP,
      }}
    >
      {/* Generate Wardrobe button */}
      <button
        type="button"
        disabled={!hasAnySelection}
        onClick={onGenerate}
        style={{
          flexShrink: 0,
          width: "100%",
          padding: "10px 8px",
          borderRadius: 12,
          border: hasAnySelection
            ? "1.5px solid rgba(79,195,247,0.6)"
            : "1.5px solid rgba(255,255,255,0.08)",
          background: hasAnySelection
            ? "rgba(79,195,247,0.15)"
            : "rgba(20,20,30,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: hasAnySelection ? "white" : "rgba(255,255,255,0.18)",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          cursor: hasAnySelection ? "pointer" : "not-allowed",
          whiteSpace: "nowrap",
        }}
      >
        Generate Wardrobe
      </button>

      {/* Slot image rows */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: ROW_GAP,
        }}
      >
        {SLOTS.map((slot) => {
          const g = selected[slot];
          const imgUrl = g ? (g.file?.fileUrl ?? g.imageUrl) : null;
          return (
            <div
              key={slot}
              onClick={() => g && onClearSlot(slot)}
              style={{
                flex: "1 1 0",
                minHeight: 0,
                position: "relative",
                borderRadius: 8,
                overflow: "hidden",
                border: g
                  ? "1.5px solid rgba(79,195,247,0.4)"
                  : "1.5px solid rgba(255,255,255,0.06)",
                background: "transparent",
                cursor: g ? "pointer" : "default",
              }}
            >
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl}
                  alt={g!.name}
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <span
                    style={{ color: "rgba(255,255,255,0.1)", fontSize: 14 }}
                  >
                    +
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.18)",
                      fontSize: 7,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {SLOT_LABELS[slot]}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Center panel — details for each slot, rows aligned with left panel images. */
function WardrobeCenterPanel({
  selected,
}: {
  selected: Record<SwapSlot, RemoteGarment | null>;
}) {
  return (
    <div
      className="h-full flex flex-col min-h-0"
      style={{
        flex: "0 0 50%",
        width: "50%",
        padding: "12px 10px",
        gap: ROW_GAP,
      }}
    >
      {/* Detail rows — same count/gap as left panel slot rows */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: ROW_GAP,
        }}
      >
        {SLOTS.map((slot) => {
          const g = selected[slot];
          return (
            <div
              key={slot}
              className="flex flex-col justify-center"
              style={{
                flex: "1 1 0",
                minHeight: 0,
                padding: "6px 12px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid transparent",
                overflow: "hidden",
              }}
            >
              {g ? (
                <>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.35)",
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 2,
                    }}
                  >
                    {SLOT_LABELS[slot]}
                  </span>
                  <span
                    style={{
                      color: "white",
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.name}
                  </span>
                  {g.description ? (
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 9,
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {g.description}
                    </span>
                  ) : null}
                </>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 9 }}>
                  —
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WardrobeCreatePage() {
  const router = useRouter();

  // Garment pools per slot — fetched from catalog
  const [topsBase, setTopsBase] = useState<RemoteGarment[]>([]);
  const [topsMid, setTopsMid] = useState<RemoteGarment[]>([]);
  const [topsOuter, setTopsOuter] = useState<RemoteGarment[]>([]);
  const [bottoms, setBottoms] = useState<RemoteGarment[]>([]);
  const [shoes, setShoes] = useState<RemoteGarment[]>([]);
  const [bags, setBags] = useState<RemoteGarment[]>([]);

  // Pagination
  const [topsBasePage, setTopsBasePage] = useState(0);
  const [topsMidPage, setTopsMidPage] = useState(0);
  const [topsOuterPage, setTopsOuterPage] = useState(0);
  const [bottomsPage, setBottomsPage] = useState(0);
  const [shoesPage, setShoesPage] = useState(0);
  const [bagsPage, setBagsPage] = useState(0);

  // Selected garment per slot
  const [selectedTopBase, setSelectedTopBase] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedTopMid, setSelectedTopMid] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedTopOuter, setSelectedTopOuter] =
    useState<RemoteGarment | null>(null);
  const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(
    null,
  );
  const [selectedShoe, setSelectedShoe] = useState<RemoteGarment | null>(null);
  const [selectedBag, setSelectedBag] = useState<RemoteGarment | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);

  const pageSize = 4;
  const topsLayerPageSize = 2;

  const pagedTopsBase = topsBase.slice(
    topsBasePage * topsLayerPageSize,
    (topsBasePage + 1) * topsLayerPageSize,
  );
  const pagedTopsMid = topsMid.slice(
    topsMidPage * topsLayerPageSize,
    (topsMidPage + 1) * topsLayerPageSize,
  );
  const pagedTopsOuter = topsOuter.slice(
    topsOuterPage * topsLayerPageSize,
    (topsOuterPage + 1) * topsLayerPageSize,
  );
  const pagedBottoms = bottoms.slice(
    bottomsPage * pageSize,
    (bottomsPage + 1) * pageSize,
  );
  const pagedShoes = shoes.slice(
    shoesPage * pageSize,
    (shoesPage + 1) * pageSize,
  );
  const pagedBags = bags.slice(bagsPage * pageSize, (bagsPage + 1) * pageSize);

  const selected: Record<SwapSlot, RemoteGarment | null> = {
    base: selectedTopBase,
    mid: selectedTopMid,
    outer: selectedTopOuter,
    bottoms: selectedBottom,
    shoes: selectedShoe,
    bags: selectedBag,
  };

  const hasRequiredSelection =
    (selected.base !== null ||
      selected.mid !== null ||
      selected.outer !== null) &&
    selected.bottoms !== null &&
    selected.shoes !== null;

  // Load catalog garments — swap this for /external/outfits?{chatWonderParams} when ready
  useEffect(() => {
    const OUTER_TYPES = new Set([
      "Blazer",
      "Jacket",
      "Coat",
      "Parka",
      "Windbreaker",
    ]);
    const MID_TYPES = new Set(["Hoodie", "Sweater", "Cardigan", "Pullover"]);

    Promise.all([
      garmentService.getBySlot(FittingSlot.UpperGarment).then((items) => {
        setTopsOuter(
          items.filter((g) => g.garmentType.some((t) => OUTER_TYPES.has(t))),
        );
        setTopsMid(
          items.filter((g) => g.garmentType.some((t) => MID_TYPES.has(t))),
        );
        setTopsBase(
          items.filter(
            (g) =>
              !g.garmentType.some(
                (t) => OUTER_TYPES.has(t) || MID_TYPES.has(t),
              ),
          ),
        );
      }),
      garmentService.getBySlot(FittingSlot.LowerGarment).then(setBottoms),
      garmentService.getBySlot(FittingSlot.FootGarment).then(setShoes),
      garmentService.getBySlot(FittingSlot.RightHandAccessory).then(setBags),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSlotSelect = (slot: SwapSlot, g: RemoteGarment) => {
    const setters: Record<SwapSlot, (g: RemoteGarment | null) => void> = {
      base: setSelectedTopBase,
      mid: setSelectedTopMid,
      outer: setSelectedTopOuter,
      bottoms: setSelectedBottom,
      shoes: setSelectedShoe,
      bags: setSelectedBag,
    };
    // Toggle: tap again to deselect
    const current = selected[slot];
    if (current?.id === g.id) {
      setters[slot](null);
      return;
    }
    // If this garment is already occupying another upper-layer slot, clear it there first
    const upperSlots: SwapSlot[] = ["base", "mid", "outer"];
    if (upperSlots.includes(slot)) {
      for (const other of upperSlots) {
        if (other !== slot && selected[other]?.id === g.id) {
          setters[other](null);
        }
      }
    }
    setters[slot](g);
  };

  const handleClearSlot = (slot: SwapSlot) => {
    const setters: Record<SwapSlot, (g: RemoteGarment | null) => void> = {
      base: setSelectedTopBase,
      mid: setSelectedTopMid,
      outer: setSelectedTopOuter,
      bottoms: setSelectedBottom,
      shoes: setSelectedShoe,
      bags: setSelectedBag,
    };
    setters[slot](null);
  };

  const garmentSlots: GarmentSlotConfig[] = [
    {
      key: "base",
      label: "Base Top",
      items: topsBase,
      pagedItems: pagedTopsBase,
      pageSize: topsLayerPageSize,
      currentPage: topsBasePage,
      totalPages: Math.max(1, Math.ceil(topsBase.length / topsLayerPageSize)),
      onPageChange: setTopsBasePage,
      selectedId: selectedTopBase?.id,
      emptyMessage: "No Base tops",
    },
    {
      key: "mid",
      label: "Mid Layer",
      items: topsMid,
      pagedItems: pagedTopsMid,
      pageSize: topsLayerPageSize,
      currentPage: topsMidPage,
      totalPages: Math.max(1, Math.ceil(topsMid.length / topsLayerPageSize)),
      onPageChange: setTopsMidPage,
      selectedId: selectedTopMid?.id,
      emptyMessage: "No Mid layers",
    },
    {
      key: "outer",
      label: "Outer Layer",
      items: topsOuter,
      pagedItems: pagedTopsOuter,
      pageSize: topsLayerPageSize,
      currentPage: topsOuterPage,
      totalPages: Math.max(1, Math.ceil(topsOuter.length / topsLayerPageSize)),
      onPageChange: setTopsOuterPage,
      selectedId: selectedTopOuter?.id,
      emptyMessage: "No Outer layers",
    },
    {
      key: "bottoms",
      label: "Bottoms",
      items: bottoms,
      pagedItems: pagedBottoms,
      pageSize,
      currentPage: bottomsPage,
      totalPages: Math.max(1, Math.ceil(bottoms.length / pageSize)),
      onPageChange: setBottomsPage,
      selectedId: selectedBottom?.id,
      emptyMessage: "No Bottoms",
    },
    {
      key: "shoes",
      label: "Shoes",
      items: shoes,
      pagedItems: pagedShoes,
      pageSize,
      currentPage: shoesPage,
      totalPages: Math.max(1, Math.ceil(shoes.length / pageSize)),
      onPageChange: setShoesPage,
      selectedId: selectedShoe?.id,
      emptyMessage: "No Shoes",
    },
    {
      key: "bags",
      label: "Bags",
      items: bags,
      pagedItems: pagedBags,
      pageSize,
      currentPage: bagsPage,
      totalPages: Math.max(1, Math.ceil(bags.length / pageSize)),
      onPageChange: setBagsPage,
      selectedId: selectedBag?.id,
      columns: 3,
      emptyMessage: "No Bags",
    },
  ];

  if (loading) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
        <MirrorHeader onBack={() => router.back()} />
        <QuoteCarousel
          quotes={FASHION_QUOTES}
          label="Style tip"
          className="flex-1 flex flex-col items-center justify-center px-6 text-center"
        />
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <MirrorHeader onBack={() => router.back()} />

      <div className="flex flex-1" style={{ height: "546px" }}>
        {/* Left panel — slot images + Generate Wardrobe button */}
        <WardrobeLeftPanel
          selected={selected}
          hasAnySelection={hasRequiredSelection}
          onClearSlot={handleClearSlot}
          onGenerate={() => setShowPreview(true)}
        />

        {/* Center panel — details aligned row-by-row with left panel images */}
        <WardrobeCenterPanel selected={selected} />

        {/* Right panel — garment pickers per slot */}
        <GarmentSelectionPanel
          slots={garmentSlots}
          swapSlot={null}
          isProcessing={false}
          onCancelSwap={() => {}}
          onSelect={handleSlotSelect}
        />
      </div>

      {showPreview && (
        <WardrobeFormModal
          selectedTopBase={selectedTopBase}
          selectedTopMid={selectedTopMid}
          selectedTopOuter={selectedTopOuter}
          selectedBottom={selectedBottom}
          selectedShoe={selectedShoe}
          selectedBag={selectedBag}
          onClose={() => setShowPreview(false)}
          onSaved={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
