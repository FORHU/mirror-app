import type {
  CosmeticTileItem,
  GarmentTileItem,
  MapTileData,
  OutfitTileItem,
  SkinAnalysisTileItem,
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
  // New format: { query, reason } — outfits fetched by the consumer, nothing to adapt here
  if (data && typeof data.query === "string")
    return { garments: [], outfits: [] };
  const sets = data && Array.isArray(data.sets) ? data.sets : [];

  const garments: GarmentTileItem[] = [];
  const outfits: OutfitTileItem[] = [];
  const seen = new Set<string>();

  for (const rawSet of sets) {
    const set = asRecord(rawSet);
    if (!set) continue;

    const outfitId =
      str(set.outfit_id) || str(set.set_number) || `set-${outfits.length}`;

    // This outfit's own pieces (dedup within the look). Each is also added to
    // the flat `garments[]` (global dedup) so the store slice stays populated.
    const outfitGarments: GarmentTileItem[] = [];
    const seenInOutfit = new Set<string>();
    const recs = Array.isArray(set.recommendations) ? set.recommendations : [];
    for (const rawRec of recs) {
      const rec = asRecord(rawRec);
      if (!rec) continue;
      const id = str(rec.id);
      const imageUrl = str(rec.imageUrl);
      if (!id || !imageUrl || seenInOutfit.has(id)) continue;
      seenInOutfit.add(id);
      const category = Array.isArray(rec.category)
        ? str(rec.category[0])
        : str(rec.category);
      const g: GarmentTileItem = {
        id,
        name: str(rec.name) || "Garment",
        imageUrl,
        category: category || undefined,
      };
      outfitGarments.push(g);
      if (!seen.has(id)) {
        seen.add(id);
        garments.push(g);
      }
    }

    // Keep the outfit if it has a hero image OR at least one piece to show.
    const outfitImage = str(set.outfit_imageUrl);
    if (outfitImage || outfitGarments.length) {
      outfits.push({
        id: outfitId,
        name: str(set.outfit_name) || `Look ${outfits.length + 1}`,
        imageUrl: outfitImage,
        vibe: str(set.vibe) || undefined,
        reason: str(set.reason) || str(set.trend_note) || undefined,
        garments: outfitGarments,
      });
    }
  }

  return { garments, outfits };
}

/** ChatWonderCosmeticsData -> flattened cosmetic cards. */
export function adaptCosmeticsData(raw: unknown): CosmeticTileItem[] {
  const data = asRecord(raw);
  if (!data && !Array.isArray(raw)) return [];

  const items: CosmeticTileItem[] = [];
  const seen = new Set<string>();

  // Helper to process an array of recommendations
  const processRecs = (recs: unknown[]) => {
    for (const rawRec of recs) {
      const rec = asRecord(rawRec);
      if (!rec) continue;
      const id = str(rec.id) || str(rec.name); // fallback to name if no id
      const imageUrl = str(rec.imageUrl);
      if (!id || !imageUrl || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        name: str(rec.name) || "Cosmetic Product",
        imageUrl,
        brand: str(rec.brand) || undefined,
      });
    }
  };

  if (Array.isArray(raw)) {
    processRecs(raw);
  } else if (data && Array.isArray(data.recommendations)) {
    processRecs(data.recommendations);
  } else if (data && Array.isArray(data.sets)) {
    for (const rawSet of data.sets) {
      const set = asRecord(rawSet);
      if (set && Array.isArray(set.recommendations)) {
        processRecs(set.recommendations);
      }
    }
  }

  return items;
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
  cosmetics: CosmeticTileItem[];
  skinAnalysis: SkinAnalysisTileItem | null;
}

function fileUrlOf(raw: unknown): string {
  const file = asRecord(raw);
  return file ? str(file.fileUrl) : "";
}

/**
 * Persisted Outline (from `/outlines/active` → `findActiveWithOverview`) → tiles.
 *
 * Lets `/overview` reflect what the user already saved (hybrid hydration); live
 * ChatWonder updates overwrite these afterward. Garments/outfits are
 * event-centric — each event carries its own `outfits[]` (→ `items[].garment`),
 * so we flatten across events. Cosmetics and the skin profile instead hang off
 * the Outline's `skinAnalysis` (ADR 0002), not events. The Map tile is
 * intentionally not built here; it derives from `useMapStore` (which geocodes
 * the events' `routeDestination` strings via `loadOutlineStops`).
 */
export function adaptOutlineToTiles(raw: unknown): OutlineTiles {
  const outline = asRecord(raw);
  const garments: GarmentTileItem[] = [];
  const outfits: OutfitTileItem[] = [];
  const cosmetics: CosmeticTileItem[] = [];
  const seenGarment = new Set<string>();
  const seenOutfit = new Set<string>();
  const seenCosmetic = new Set<string>();

  const events = outline && Array.isArray(outline.events) ? outline.events : [];

  // Primary cosmetics source: the outline's own master list, refreshed on every
  // cosmetics turn (resolveAndPersistOutlineCosmetics). Each recommendation nests its
  // product under `cosmeticProduct`, with the image at `cosmeticProduct.fileUrl.fileUrl`.
  const outlineRecs =
    outline && Array.isArray(outline.cosmeticRecommendations)
      ? outline.cosmeticRecommendations
      : [];
  for (const rawRec of outlineRecs) {
    const rec = asRecord(rawRec);
    if (!rec) continue;
    const product = asRecord(rec.cosmeticProduct);
    const id = str(rec.id);
    const imageUrl = product ? fileUrlOf(product.fileUrl) : "";
    if (!id || !imageUrl || seenCosmetic.has(id)) continue;
    seenCosmetic.add(id);
    cosmetics.push({
      id,
      name: (product && str(product.name)) || "Cosmetic Product",
      imageUrl,
      brand: (product && str(product.brand)) || undefined,
    });
  }

  let skinAnalysis: SkinAnalysisTileItem | null = null;
  const rawAnalysis = asRecord(outline?.skinAnalysis);
  if (rawAnalysis) {
    skinAnalysis = {
      skinType: str(rawAnalysis.skinType) || "Unknown",
      skinTone: str(rawAnalysis.skinTone) || null,
      hydrationPct: num(rawAnalysis.hydrationPct) ?? 50,
      oilinessPct: num(rawAnalysis.oilinessPct) ?? 50,
      concerns: Array.isArray(rawAnalysis.concerns)
        ? rawAnalysis.concerns.map(str)
        : [],
      imageUrl: fileUrlOf(rawAnalysis.file) || null,
    };

    // Cosmetics hang off the SkinAnalysis (ADR 0002: "Cosmetics done = skinAnalysisId
    // set"), not off events. Each recommendation nests its product under
    // `cosmeticProduct` with the image at `cosmeticProduct.fileUrl.fileUrl`.
    const recs = Array.isArray(rawAnalysis.recommendations)
      ? rawAnalysis.recommendations
      : [];
    for (const rawRec of recs) {
      const rec = asRecord(rawRec);
      if (!rec) continue;
      const product = asRecord(rec.cosmeticProduct);
      const id = str(rec.id);
      const imageUrl = product ? fileUrlOf(product.fileUrl) : "";
      if (!id || !imageUrl || seenCosmetic.has(id)) continue;
      seenCosmetic.add(id);
      cosmetics.push({
        id,
        name: (product && str(product.name)) || "Cosmetic Product",
        imageUrl,
        brand: (product && str(product.brand)) || undefined,
      });
    }
  }

  for (const rawEvent of events) {
    const event = asRecord(rawEvent);
    if (!event) continue;

    const evOutfits = Array.isArray(event.outfits) ? event.outfits : [];
    for (const rawOutfit of evOutfits) {
      const outfit = asRecord(rawOutfit);
      if (!outfit) continue;

      const outfitId = str(outfit.id);
      if (!outfitId || seenOutfit.has(outfitId)) continue;

      // This look's own pieces (dedup within the outfit). Each is also added to
      // the flat `garments[]` (global dedup) so the store slice stays populated.
      const outfitGarments: GarmentTileItem[] = [];
      const seenInOutfit = new Set<string>();
      const items = Array.isArray(outfit.items) ? outfit.items : [];
      for (const rawItem of items) {
        const item = asRecord(rawItem);
        const garment = item && asRecord(item.garment);
        if (!garment) continue;
        const id = str(garment.id);
        const imageUrl = str(garment.imageUrl) || fileUrlOf(garment.file);
        if (!id || !imageUrl || seenInOutfit.has(id)) continue;
        seenInOutfit.add(id);
        const category = Array.isArray(garment.category)
          ? str(garment.category[0])
          : str(garment.category);
        const g: GarmentTileItem = {
          id,
          name: str(garment.name) || "Garment",
          imageUrl,
          category: category || undefined,
        };
        outfitGarments.push(g);
        if (!seenGarment.has(id)) {
          seenGarment.add(id);
          garments.push(g);
        }
      }

      // Keep the outfit if it has a hero image OR at least one piece to show.
      const outfitImage = fileUrlOf(outfit.file);
      if (!outfitImage && !outfitGarments.length) continue;
      seenOutfit.add(outfitId);
      outfits.push({
        id: outfitId,
        name: str(outfit.name) || `Look ${outfits.length + 1}`,
        imageUrl: outfitImage,
        reason: str(outfit.description) || undefined,
        garments: outfitGarments,
      });
    }
  }

  return { garments, outfits, cosmetics, skinAnalysis };
}
