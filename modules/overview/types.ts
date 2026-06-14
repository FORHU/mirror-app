/**
 * Lifecycle of a single grid tile:
 *  - idle    → nothing requested yet (renders the disclaimer-friendly skeleton)
 *  - loading → a tool/analysis is in flight (renders an animated skeleton)
 *  - ready   → data arrived (renders the real content)
 *  - empty   → tool ran but returned nothing
 *  - error   → tool/analysis failed
 */
export type TileStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface TileState<T> {
  status: TileStatus;
  data: T | null;
  error: string | null;
}

export interface GarmentTileItem {
  id: string;
  name: string;
  imageUrl: string;
  category?: string;
  description?: string;
  garmentType?: string[];
  silhouette?: string;
  fittingSlot?: string[];
  layerLevel?: string;
}

export interface OutfitTileItem {
  id: string;
  name: string;
  imageUrl: string;
  vibe?: string;
  reason?: string;
  /** The garments that make up this look. Mirrors the persisted shape
   *  (outfit.items[].garment) and the live shape (set.recommendations[]). */
  garments: GarmentTileItem[];
  metaTags?: string[];
  silhouette?: string;
  garmentType?: string[];
  category?: string[];
}

export interface CosmeticTileItem {
  id: string;
  name: string;
  imageUrl: string;
  brand?: string;
  category?: string;
  type?: string;
  tags?: string[];
  benefits?: string[];
  details?: string;
  reason?: string;
  metaData?: Record<string, unknown>;
  hexColor?: string;
  priceAmount?: number;
  priceUnit?: string;
  spf?: number;
  waterproof?: boolean;
  hydrating?: boolean;
  oilFree?: boolean;
}

export interface MapTileData {
  /** Primary destination / first stop label. */
  name: string;
  address?: string;
  lat: number;
  lng: number;
  /** Multi-stop itinerary, when ChatWonder resolved several events. */
  stops?: { name: string; lat: number; lng: number }[];
}

export interface SkinAnalysisTileItem {
  skinType: string;
  skinTone: string | null;
  hydrationPct: number;
  oilinessPct: number;
  concerns: string[];
  imageUrl: string | null;
}
