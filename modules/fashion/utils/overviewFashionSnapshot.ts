import type { CreatedOutfit } from "@/modules/shared/api/outfit.service";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import type {
  GarmentTileItem,
  OutfitTileItem,
} from "@/modules/overview/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function createdOutfitImageUrl(created: CreatedOutfit): string {
  const raw = asRecord(created);
  const file = asRecord(raw?.file);
  return (
    str(file?.fileUrl) ||
    str(file?.url) ||
    str(raw?.fileUrl) ||
    str(raw?.imageUrl)
  );
}

function toGarmentTile(garment: RemoteGarment): GarmentTileItem | null {
  if (!garment.id || !garment.imageUrl) return null;
  return {
    id: garment.id,
    name: garment.name || "Garment",
    imageUrl: garment.imageUrl,
    category:
      garment.category?.[0] ??
      garment.garmentType?.[0] ??
      garment.fittingSlot?.[0] ??
      undefined,
  };
}

export function addCreatedOutfitToOverviewSnapshot({
  created,
  fallbackName,
  fallbackDescription,
  garments,
}: {
  created: CreatedOutfit;
  fallbackName: string;
  fallbackDescription?: string;
  garments: Array<RemoteGarment | null>;
}) {
  const garmentTiles = garments
    .filter((g): g is RemoteGarment => Boolean(g))
    .map(toGarmentTile)
    .filter((g): g is GarmentTileItem => Boolean(g));

  const outfit: OutfitTileItem = {
    id: created.id || `created-${Date.now()}`,
    name: created.name || fallbackName,
    imageUrl: createdOutfitImageUrl(created),
    reason: fallbackDescription,
    garments: garmentTiles,
  };

  const current = useMirrorStore.getState().overviewFashionSnapshot ?? {
    garments: [],
    outfits: [],
  };

  const seenGarments = new Set<string>();
  const nextGarments = [...garmentTiles, ...current.garments].filter((item) => {
    if (seenGarments.has(item.id)) return false;
    seenGarments.add(item.id);
    return true;
  });

  const nextOutfits = [
    outfit,
    ...current.outfits.filter((item) => item.id !== outfit.id),
  ];

  useMirrorStore.getState().setOverviewFashionSnapshot({
    garments: nextGarments,
    outfits: nextOutfits,
  });
}
