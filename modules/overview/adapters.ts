import type {
  GarmentTileItem,
  MapTileData,
  OutfitTileItem,
} from "./types";

/**
 * Normalizers from ChatWonder's loosely-typed tool payloads into the tile
 * shapes the grid renders. Both the text-stream `complete` blocks and the voice
 * `GARMENT_RECOMMENDATION` action carry the same `ChatWonderGarmentData`
 * ({ sets: [...] }) / `ChatWonderMapsData`, so one adapter serves both paths.
 *
 * Everything here is defensive — any missing/odd field yields a safe fallback
 * rather than throwing, because the payload originates from an LLM.
 */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  return null;
}

export interface GarmentAdaptResult {
  garments: GarmentTileItem[];
  outfits: OutfitTileItem[];
}

/** ChatWonderGarmentData → flattened garment cards + per-set outfit cards. */
export function adaptGarmentData(raw: unknown): GarmentAdaptResult {
  const data = asRecord(raw);
  const sets = data && Array.isArray(data.sets) ? data.sets : [];

  const garments: GarmentTileItem[] = [];
  const outfits: OutfitTileItem[] = [];
  const seen = new Set<string>();

  for (const rawSet of sets) {
    const set = asRecord(rawSet);
    if (!set) continue;

    const outfitId =
      str(set.outfit_id) || str(set.set_number) || `set-${outfits.length}`;
    const outfitImage = str(set.outfit_imageUrl);
    if (outfitImage) {
      outfits.push({
        id: outfitId,
        name: str(set.outfit_name) || `Look ${outfits.length + 1}`,
        imageUrl: outfitImage,
        vibe: str(set.vibe) || undefined,
        reason: str(set.reason) || str(set.trend_note) || undefined,
      });
    }

    const recs = Array.isArray(set.recommendations) ? set.recommendations : [];
    for (const rawRec of recs) {
      const rec = asRecord(rawRec);
      if (!rec) continue;
      const id = str(rec.id);
      const imageUrl = str(rec.imageUrl);
      if (!id || !imageUrl || seen.has(id)) continue;
      seen.add(id);
      const category = Array.isArray(rec.category)
        ? str(rec.category[0])
        : str(rec.category);
      garments.push({
        id,
        name: str(rec.name) || "Garment",
        imageUrl,
        category: category || undefined,
      });
    }
  }

  return { garments, outfits };
}

/** ChatWonderMapsData (or a maps_data[0] entry) → a single map tile. */
export function adaptMapsData(raw: unknown): MapTileData | null {
  const data = asRecord(raw);
  if (!data) return null;

  const lat = num(data.lat);
  const lng = num(data.lng);
  if (lat === null || lng === null) return null;

  const places = Array.isArray(data.places) ? data.places : [];
  const stops = places
    .map((p) => {
      const place = asRecord(p);
      if (!place) return null;
      const pLat = num(place.lat);
      const pLng = num(place.lng);
      if (pLat === null || pLng === null) return null;
      return { name: str(place.name) || "Place", lat: pLat, lng: pLng };
    })
    .filter((s): s is { name: string; lat: number; lng: number } => s !== null);

  return {
    name: str(data.location_label) || str(data.query) || "Destination",
    lat,
    lng,
    stops: stops.length ? stops : undefined,
  };
}

export interface OutlineTiles {
  garments: GarmentTileItem[];
  outfits: OutfitTileItem[];
}

function fileUrlOf(raw: unknown): string {
  const file = asRecord(raw);
  return file ? str(file.fileUrl) : "";
}

/**
 * Persisted Outline (from `/outlines/active` → `findActiveWithOverview`) → tiles.
 *
 * Lets `/overview` reflect what the user already saved (hybrid hydration); live
 * ChatWonder updates overwrite these afterward. The Outline is event-centric —
 * each event carries its own `outfits[]` (→ `items[].garment`) and
 * `cosmeticRecommendations[]` — so we flatten across events. The Map tile is
 * intentionally not built here; it derives from `useMapStore` (which geocodes
 * the events' `routeDestination` strings via `loadOutlineStops`).
 */
export function adaptOutlineToTiles(raw: unknown): OutlineTiles {
  const outline = asRecord(raw);
  const garments: GarmentTileItem[] = [];
  const outfits: OutfitTileItem[] = [];
  const seenGarment = new Set<string>();
  const seenOutfit = new Set<string>();

  const events = outline && Array.isArray(outline.events) ? outline.events : [];

  for (const rawEvent of events) {
    const event = asRecord(rawEvent);
    if (!event) continue;

    const evOutfits = Array.isArray(event.outfits) ? event.outfits : [];
    for (const rawOutfit of evOutfits) {
      const outfit = asRecord(rawOutfit);
      if (!outfit) continue;

      const outfitId = str(outfit.id);
      const outfitImage = fileUrlOf(outfit.file);
      if (outfitId && outfitImage && !seenOutfit.has(outfitId)) {
        seenOutfit.add(outfitId);
        outfits.push({
          id: outfitId,
          name: str(outfit.name) || `Look ${outfits.length + 1}`,
          imageUrl: outfitImage,
          reason: str(outfit.description) || undefined,
        });
      }

      const items = Array.isArray(outfit.items) ? outfit.items : [];
      for (const rawItem of items) {
        const item = asRecord(rawItem);
        const garment = item && asRecord(item.garment);
        if (!garment) continue;
        const id = str(garment.id);
        const imageUrl = str(garment.imageUrl) || fileUrlOf(garment.file);
        if (!id || !imageUrl || seenGarment.has(id)) continue;
        seenGarment.add(id);
        const category = Array.isArray(garment.category)
          ? str(garment.category[0])
          : str(garment.category);
        garments.push({
          id,
          name: str(garment.name) || "Garment",
          imageUrl,
          category: category || undefined,
        });
      }
    }
  }

  return { garments, outfits };
}
