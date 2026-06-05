"use client";

import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import type { RemoteOutfit } from "@/modules/shared/api/outfit.service";
import OutfitPreviewCanvas from "@/components/OutfitPreviewCanvas";

type SwapSlot = "base" | "mid" | "outer" | "bottoms" | "shoes" | "bags";

function resolveSwapSlot(
  garmentType: string[],
  fittingSlot: string[],
): SwapSlot {
  if (garmentType.includes("Bag")) return "bags";
  if (fittingSlot.includes("LowerGarment")) return "bottoms";
  if (fittingSlot.includes("FootGarment")) return "shoes";
  const t = garmentType[0] ?? "";
  if (["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"].includes(t))
    return "outer";
  if (["Hoodie", "Sweater", "Cardigan", "Pullover"].includes(t)) return "mid";
  return "base";
}

export interface OutfitPreviewModalProps {
  outfitModified: boolean;
  activeOutfit: RemoteOutfit | null;
  outfitOverrides: Record<string, RemoteGarment>;
  selectedTopBase: RemoteGarment | null;
  selectedTopMid: RemoteGarment | null;
  selectedTopOuter: RemoteGarment | null;
  selectedBottom: RemoteGarment | null;
  selectedShoe: RemoteGarment | null;
  selectedBag: RemoteGarment | null;
  onClose: () => void;
}

export function OutfitPreviewModal({
  outfitModified,
  activeOutfit,
  outfitOverrides,
  selectedTopBase,
  selectedTopMid,
  selectedTopOuter,
  selectedBottom,
  selectedShoe,
  selectedBag,
  onClose,
}: OutfitPreviewModalProps) {
  let cBase: RemoteGarment | null = selectedTopBase;
  let cMid: RemoteGarment | null = selectedTopMid;
  let cOuter: RemoteGarment | null = selectedTopOuter;
  let cBottom: RemoteGarment | null = selectedBottom;
  let cShoe: RemoteGarment | null = selectedShoe;
  let cBag: RemoteGarment | null = selectedBag;

  if (activeOutfit) {
    cBase = null;
    cMid = null;
    cOuter = null;
    cBottom = null;
    cShoe = null;
    cBag = null;
    for (const item of activeOutfit.items) {
      const eff = (outfitOverrides[item.id] ?? item.garment) as RemoteGarment;
      if (eff.garmentType?.includes("Bag")) {
        cBag = eff;
        continue;
      }
      if (item.slot === "LowerGarment") {
        cBottom = eff;
        continue;
      }
      if (item.slot === "FootGarment") {
        cShoe = eff;
        continue;
      }
      if (item.slot === "UpperGarment") {
        const layer = resolveSwapSlot(
          eff.garmentType ?? [],
          eff.fittingSlot ?? [],
        );
        if (layer === "outer") cOuter = eff;
        else if (layer === "mid") cMid = eff;
        else cBase = eff;
      }
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "20px",
          padding: "24px 20px",
          width: "360px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          style={{
            color: "white",
            fontSize: "20px",
            fontWeight: "700",
            textAlign: "center",
            margin: 0,
          }}
        >
          {outfitModified ? "Customized Look" : "Your Look"}
        </p>

        <div
          style={{
            width: "100%",
            aspectRatio: "2/3",
            borderRadius: "12px",
            overflow: "hidden",
            background: "#1a1a1a",
          }}
        >
          <OutfitPreviewCanvas
            topBase={cBase}
            topMid={cMid}
            topOuter={cOuter}
            bottom={cBottom}
            shoe={cShoe}
            bag={cBag}
          />
        </div>

        <button
          style={{
            width: "100%",
            padding: "12px",
            background: "#ffffff",
            border: "none",
            borderRadius: "12px",
            color: "#000",
            fontSize: "15px",
            fontWeight: "700",
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
