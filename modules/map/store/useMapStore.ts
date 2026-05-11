import { create } from "zustand";
import { GeocodingFeature, DirectionsResponse, mapService } from "@/modules/shared/api/map.service";
import { INITIAL_VIEW_STATE } from "../constants/config";

interface MapState {
  origin: [number, number];
  destination: GeocodingFeature | null;
  searchResults: GeocodingFeature[];
  activeRoute: any | null; // Using any temporarily to avoid complex nesting issues, or we can use DirectionsResponse["data"]
  isSearching: boolean;
  isRouting: boolean;
  
  // Actions
  setOrigin: (coords: [number, number]) => void;
  setDestination: (feature: GeocodingFeature | null) => void;
  searchLocations: (query: string) => Promise<void>;
  fetchRoute: () => Promise<void>;
  clearNavigation: () => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  origin: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
  destination: null,
  searchResults: [],
  activeRoute: null,
  isSearching: false,
  isRouting: false,

  setOrigin: (origin) => set({ origin }),

  setDestination: (destination) => {
    set({ destination, searchResults: [] });
    if (destination) {
      get().fetchRoute();
    }
  },

  searchLocations: async (query) => {
    if (!query) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    
    set({ isSearching: true });
    try {
      const results = await mapService.search(query);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      console.error("Search error:", error);
      set({ isSearching: false });
    }
  },

  fetchRoute: async () => {
    const { origin, destination } = get();
    if (!destination) return;

    set({ isRouting: true });
    try {
      const route = await mapService.getDirections(origin, destination.center);
      set({ activeRoute: route, isRouting: false });
    } catch (error) {
      console.error("Route error:", error);
      set({ isRouting: false });
    }
  },

  clearNavigation: () => set({ 
    destination: null, 
    activeRoute: null, 
    searchResults: [] 
  }),
}));
