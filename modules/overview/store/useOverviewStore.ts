"use client";

import { create } from "zustand";
import type {
  GarmentTileItem,
  OutfitTileItem,
  CosmeticTileItem,
  SkinAnalysisTileItem,
  TileState,
} from "../types";

/**
 * useOverviewStore — single source of truth for the /overview grid.
 *
 * The page orchestrates several independent data sources (background skin
 * analysis over Socket.io, ChatWonder tool payloads, the shared map store) and
 * funnels each into its tile here. Tiles render skeletons until their slice
 * flips to `ready`, so the store IS the skeleton ↔ data gate.
 */

function idle<T>(): TileState<T> {
  return { status: "idle", data: null, error: null };
}

interface OverviewState {
  /** Camera/face-tracker has locked onto a face (kicks off greeting + skin scan). */
  faceDetected: boolean;
  /** The AI's spoken/greeting line, shown over the grid. */
  greeting: string | null;

  garments: TileState<GarmentTileItem[]>;
  outfits: TileState<OutfitTileItem[]>;
  cosmetics: TileState<CosmeticTileItem[]>;
  skinAnalysis: TileState<SkinAnalysisTileItem>;

  setFaceDetected: (v: boolean) => void;
  setGreeting: (s: string | null) => void;

  startGarments: () => void;
  setGarments: (items: GarmentTileItem[]) => void;

  startOutfits: () => void;
  setOutfits: (items: OutfitTileItem[]) => void;

  startCosmetics: () => void;
  setCosmetics: (items: CosmeticTileItem[]) => void;

  setSkinAnalysis: (item: SkinAnalysisTileItem | null) => void;

  startMap: () => void;
  setMap: (data: MapTileData) => void;
  emptyMap: () => void;
  failMap: (error: string) => void;

  pendingPrompt: string | null;
  setPendingPrompt: (prompt: string | null) => void;

  reset: () => void;
}

const initial = {
  faceDetected: false,
  greeting: null as string | null,
  garments: idle<GarmentTileItem[]>(),
  outfits: idle<OutfitTileItem[]>(),
  cosmetics: idle<CosmeticTileItem[]>(),
  skinAnalysis: idle<SkinAnalysisTileItem>(),
  pendingPrompt: null as string | null,
};

export const useOverviewStore = create<OverviewState>((set) => ({
  ...initial,

  setFaceDetected: (v) => set({ faceDetected: v }),
  setGreeting: (s) => set({ greeting: s }),

  startGarments: () =>
    set({ garments: { status: "loading", data: null, error: null } }),
  setGarments: (items) =>
    set({
      garments: {
        status: items.length ? "ready" : "empty",
        data: items,
        error: null,
      },
    }),

  startOutfits: () =>
    set({ outfits: { status: "loading", data: null, error: null } }),
  setOutfits: (items) =>
    set({
      outfits: {
        status: items.length ? "ready" : "empty",
        data: items,
        error: null,
      },
    }),

  startCosmetics: () =>
    set({ cosmetics: { status: "loading", data: null, error: null } }),
  setCosmetics: (items) =>
    set({
      cosmetics: {
        status: items.length ? "ready" : "empty",
        data: items,
        error: null,
      },
    }),

  setSkinAnalysis: (item) =>
    set({
      skinAnalysis: {
        status: item ? "ready" : "empty",
        data: item,
        error: null,
      },
    }),

  startMap: () => set({ map: { status: "loading", data: null, error: null } }),
  setMap: (data) => set({ map: { status: "ready", data, error: null } }),
  emptyMap: () => set({ map: { status: "empty", data: null, error: null } }),
  failMap: (error) => set({ map: { status: "error", data: null, error } }),

  setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),

  reset: () => set({ ...initial }),
}));
