"use client";

import { create } from "zustand";
import type {
  GarmentTileItem,
  MapTileData,
  OutfitTileItem,
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
  map: TileState<MapTileData>;

  setFaceDetected: (v: boolean) => void;
  setGreeting: (s: string | null) => void;

  startGarments: () => void;
  setGarments: (items: GarmentTileItem[]) => void;

  startOutfits: () => void;
  setOutfits: (items: OutfitTileItem[]) => void;

  startMap: () => void;
  setMap: (data: MapTileData) => void;
  emptyMap: () => void;
  failMap: (error: string) => void;

  reset: () => void;
}

const initial = {
  faceDetected: false,
  greeting: null as string | null,
  garments: idle<GarmentTileItem[]>(),
  outfits: idle<OutfitTileItem[]>(),
  map: idle<MapTileData>(),
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

  startMap: () => set({ map: { status: "loading", data: null, error: null } }),
  setMap: (data) => set({ map: { status: "ready", data, error: null } }),
  emptyMap: () => set({ map: { status: "empty", data: null, error: null } }),
  failMap: (error) => set({ map: { status: "error", data: null, error } }),

  reset: () => set({ ...initial }),
}));
