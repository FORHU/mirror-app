"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MirrorHeader from "@/components/MirrorHeader";
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

const SLOT_LABELS: Record<SwapSlot, string> = {
  base: "Base Top",
  mid: "Mid Layer",
  outer: "Outer Layer",
  bottoms: "Bottoms",
  shoes: "Shoes",
  bags: "Bag",
};

/** Left panel — shows each slot with selected garment thumbnail or empty placeholder. */
function WardrobeSlotsPanel({
  selected,
  onClearSlot,
}: {
  selected: Record<SwapSlot, RemoteGarment | null>;
  onClearSlot: (slot: SwapSlot) => void;
}) {
  const slots: SwapSlot[] = ["base", "mid", "outer", "bottoms", "shoes", "bags"];
  return (
    <div
      className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden"
      style={{ flex: "0 0 25%", width: "25%" }}
    >
      <span
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          paddingLeft: 4,
        }}
      >
        Your Wardrobe
      </span>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          overflow: "hidden",
        }}
      >
        {slots.map((slot) => {
          const g = selected[slot];
          const imgUrl = g ? (g.file?.fileUrl ?? g.imageUrl) : null;
          return (
            <div
              key={slot}
              style={{
                flex: "1 1 0",
                minHeight: 0,
                display: "flex",
                borderRadius: 8,
                overflow: "hidden",
                border: g
                  ? "1.5px solid rgba(79,195,247,0.4)"
                  : "1.5px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                position: "relative",
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
                    style={{ color: "rgba(255,255,255,0.12)", fontSize: 16 }}
                  >
                    +
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.2)",
                      fontSize: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {SLOT_LABELS[slot]}
                  </span>
                </div>
              )}
              {g && (
                <button
                  type="button"
                  onClick={() => onClearSlot(slot)}
                  onTouchStart={() => onClearSlot(slot)}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.7)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 8,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  ✕
                </button>
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
  const [selectedTopBase, setSelectedTopBase] = useState<RemoteGarment | null>(null);
  const [selectedTopMid, setSelectedTopMid] = useState<RemoteGarment | null>(null);
  const [selectedTopOuter, setSelectedTopOuter] = useState<RemoteGarment | null>(null);
  const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(null);
  const [selectedShoe, setSelectedShoe] = useState<RemoteGarment | null>(null);
  const [selectedBag, setSelectedBag] = useState<RemoteGarment | null>(null);

  const [showPreview, setShowPreview] = useState(false);

  const pageSize = 4;
  const topsLayerPageSize = 2;

  const pagedTopsBase = topsBase.slice(topsBasePage * topsLayerPageSize, (topsBasePage + 1) * topsLayerPageSize);
  const pagedTopsMid = topsMid.slice(topsMidPage * topsLayerPageSize, (topsMidPage + 1) * topsLayerPageSize);
  const pagedTopsOuter = topsOuter.slice(topsOuterPage * topsLayerPageSize, (topsOuterPage + 1) * topsLayerPageSize);
  const pagedBottoms = bottoms.slice(bottomsPage * pageSize, (bottomsPage + 1) * pageSize);
  const pagedShoes = shoes.slice(shoesPage * pageSize, (shoesPage + 1) * pageSize);
  const pagedBags = bags.slice(bagsPage * pageSize, (bagsPage + 1) * pageSize);

  const selected: Record<SwapSlot, RemoteGarment | null> = {
    base: selectedTopBase,
    mid: selectedTopMid,
    outer: selectedTopOuter,
    bottoms: selectedBottom,
    shoes: selectedShoe,
    bags: selectedBag,
  };

  const hasAnySelection = Object.values(selected).some(Boolean);

  // Load catalog garments — swap this for /external/outfits?{chatWonderParams} when ready
  useEffect(() => {
    const OUTER_TYPES = new Set(["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"]);
    const MID_TYPES = new Set(["Hoodie", "Sweater", "Cardigan", "Pullover"]);

    garmentService.getBySlot(FittingSlot.UpperGarment).then((items) => {
      setTopsOuter(items.filter((g) => g.garmentType.some((t) => OUTER_TYPES.has(t))));
      setTopsMid(items.filter((g) => g.garmentType.some((t) => MID_TYPES.has(t))));
      setTopsBase(items.filter((g) => !g.garmentType.some((t) => OUTER_TYPES.has(t) || MID_TYPES.has(t))));
    }).catch(() => {});

    garmentService.getBySlot(FittingSlot.LowerGarment).then(setBottoms).catch(() => {});
    garmentService.getBySlot(FittingSlot.FootGarment).then(setShoes).catch(() => {});
    garmentService.getBySlot(FittingSlot.RightHandAccessory).then(setBags).catch(() => {});
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
      <MirrorHeader onBack={() => router.back()} />

      <div className="flex flex-1" style={{ height: "546px" }}>
        {/* Left panel — wardrobe slot summary */}
        <WardrobeSlotsPanel selected={selected} onClearSlot={handleClearSlot} />

        {/* Center panel — selected garment cards */}
        <div
          className="h-full flex flex-col items-center pt-8 gap-1 overflow-hidden"
          style={{ flex: "0 0 50%", width: "50%", minHeight: 0 }}
        >
          {hasAnySelection ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                padding: "0 10px 145px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                overflow: "hidden",
              }}
            >
              {(
                [
                  ["base", selectedTopBase],
                  ["mid", selectedTopMid],
                  ["outer", selectedTopOuter],
                  ["bags", selectedBag],
                  ["bottoms", selectedBottom],
                  ["shoes", selectedShoe],
                ] as [SwapSlot, RemoteGarment | null][]
              )
                .filter((s): s is [SwapSlot, RemoteGarment] => s[1] !== null)
                .map(([slot, g]) => {
                  const imgUrl = g.file?.fileUrl ?? g.imageUrl;
                  return (
                    <div
                      key={slot}
                      className="flex"
                      style={{
                        flexShrink: 0,
                        height: 110,
                        width: "100%",
                        alignItems: "stretch",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          flex: "0 0 38%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "8px 0 0 8px",
                          overflow: "hidden",
                        }}
                      >
                        {imgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgUrl}
                            alt={g.name}
                            draggable={false}
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                            No Image
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: "8px 10px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: 3,
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 9,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {SLOT_LABELS[slot]}
                        </span>
                        <span
                          style={{
                            color: "white",
                            fontSize: 12,
                            fontWeight: 600,
                            lineHeight: 1.3,
                            overflow: "hidden",
                          }}
                        >
                          {g.name}
                        </span>
                        <span
                          style={{
                            color: "rgba(255,255,255,0.45)",
                            fontSize: 10,
                            lineHeight: 1.4,
                            overflow: "hidden",
                          }}
                        >
                          {g.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingBottom: 120,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 13 }}>
                Select pieces from the right panel
              </span>
              <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 11 }}>
                to build your wardrobe
              </span>
            </div>
          )}
        </div>

        {/* Right panel — garment pickers per slot */}
        <GarmentSelectionPanel
          slots={garmentSlots}
          swapSlot={null}
          isProcessing={false}
          onCancelSwap={() => {}}
          onSelect={handleSlotSelect}
        />
      </div>

      {/* Generate Wardrobe button */}
      <div
        style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 40,
        }}
      >
        <button
          type="button"
          disabled={!hasAnySelection}
          onClick={() => setShowPreview(true)}
          style={{
            padding: "14px 40px",
            borderRadius: 24,
            border: hasAnySelection
              ? "1.5px solid rgba(79,195,247,0.6)"
              : "1.5px solid rgba(255,255,255,0.1)",
            background: hasAnySelection
              ? "rgba(79,195,247,0.15)"
              : "rgba(20,20,30,0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: hasAnySelection ? "white" : "rgba(255,255,255,0.2)",
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            cursor: hasAnySelection ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
        >
          Generate Wardrobe
        </button>
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
