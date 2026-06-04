import type { SkinAnalysis } from "@/modules/shared/api/cosmetics.service";

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
}

export interface OutfitTileItem {
  id: string;
  name: string;
  imageUrl: string;
  vibe?: string;
  reason?: string;
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

export type CosmeticsTileData = SkinAnalysis;
