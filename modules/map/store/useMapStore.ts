import { create } from "zustand";
import { DEVICE_MODE } from "@/modules/shared/config/device.config";
import { mapService } from "../services/map.service";

interface MapStore {
  deviceMode: 'mirror';
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map) => void;
  homeLocation: { lat: number; lng: number } | null;
  homeLocationStatus: 'idle' | 'loading' | 'loaded' | 'error';
  mapStyle: 'mirror' | 'standard';
  cameraMode: 'follow' | 'overview' | 'free';
  isNavigating: boolean;
  currentStepIndex: number;
  distanceToNextManeuver: number;
  remainingDistance: number;
  remainingDuration: number;
  activeRoute: any | null;
  
  // Search state
  searchResults: any[];
  isSearching: boolean;
  selectedDestination: any | null;
  selectedPOI: any | null;
  activeProfile: 'car' | 'motorcycle' | 'bicycle' | 'walking';
  showTraffic: boolean;
  showTerrain: boolean;
  isRouting: boolean;
  userLocation: { lat: number; lng: number } | null;
  origin: { lat: number; lng: number } | null;

  loadHomeLocation(): Promise<void>;
  saveHomeLocation(coords: { lat: number; lng: number }): Promise<void>;
  setUserLocation: (coords: { lat: number; lng: number }) => void;
  setCameraMode: (mode: 'follow' | 'overview' | 'free') => void;
  toggleMapStyle: () => void;
  toggleTraffic: () => void;
  toggleTerrain: () => void;
  
  // Navigation actions
  searchLocations: (query: string) => Promise<void>;
  setDestination: (location: any) => Promise<void>;
  setSelectedPOI: (poi: any) => void;
  setActiveProfile: (profile: 'car' | 'motorcycle' | 'bicycle' | 'walking') => void;
  fetchRoute(force?: boolean): Promise<void>;
  startNavigation(): void;
  stopNavigation(): void;
  clearNavigation(): void;
  updateNavigationProgress(location: { lat: number; lng: number }): void;
}

export const useMapStore = create<MapStore>((set, get) => ({
  deviceMode: DEVICE_MODE as 'mirror',
  map: null,
  setMap: (map) => set({ map }),
  homeLocation: null,
  homeLocationStatus: 'idle',
  mapStyle: 'mirror',
  cameraMode: 'free',
  isNavigating: false,
  currentStepIndex: 0,
  distanceToNextManeuver: 0,
  remainingDistance: 0,
  remainingDuration: 0,
  activeRoute: null,

  // Search state
  searchResults: [],
  isSearching: false,
  selectedDestination: null,
  selectedPOI: null,
  activeProfile: 'car',
  showTraffic: false,
  showTerrain: false,
  isRouting: false,
  userLocation: null,
  origin: null,

  loadHomeLocation: async () => {
    set({ homeLocationStatus: 'loading' });
    try {
      const data = await mapService.getHomeLocation();
      set({ 
        homeLocation: data.homeLocation, 
        userLocation: data.homeLocation,
        origin: data.homeLocation,
        homeLocationStatus: 'loaded' 
      });
    } catch (error) {
      set({ homeLocationStatus: 'error' });
    }
  },

  saveHomeLocation: async (coords) => {
    set({ homeLocationStatus: 'loading' });
    try {
      await mapService.setHomeLocation(coords);
      set({ 
        homeLocation: coords, 
        userLocation: coords,
        origin: coords,
        homeLocationStatus: 'loaded' 
      });
    } catch (error) {
      set({ homeLocationStatus: 'error' });
    }
  },

  setUserLocation: (coords) => set({ userLocation: coords }),

  setCameraMode: (cameraMode) => set({ cameraMode }),

  toggleMapStyle: () => set((state) => ({ 
    mapStyle: state.mapStyle === 'mirror' ? 'standard' : 'mirror' 
  })),
  
  toggleTraffic: () => set((state) => ({ showTraffic: !state.showTraffic })),
  toggleTerrain: () => set((state) => ({ showTerrain: !state.showTerrain })),

  searchLocations: async (query: string) => {
    set({ isSearching: true });
    try {
      const { userLocation, homeLocation } = get();
      const proximity = userLocation ?? homeLocation ?? undefined;
      const data = await mapService.geocode(query, proximity ?? undefined);
      set({ searchResults: data.results, isSearching: false });
    } catch (error) {
      set({ isSearching: false });
    }
  },

  fetchRoute: async (_force = false) => {
    const { selectedDestination, homeLocation, activeProfile } = get();
    if (!selectedDestination || !homeLocation) return;
    
    set({ isRouting: true });
    try {
      const route = await mapService.directions(
        [homeLocation.lng, homeLocation.lat],
        [selectedDestination.lng, selectedDestination.lat],
        activeProfile
      );
      set({ 
        activeRoute: route, 
        remainingDistance: route.distance, 
        remainingDuration: route.duration,
        isRouting: false
      });
    } catch (error) {
      set({ isRouting: false });
      console.error("Routing error:", error);
    }
  },

  setDestination: async (location: any) => {
    set({ selectedDestination: location, isSearching: false, searchResults: [] });
    get().fetchRoute();
  },

  setSelectedPOI: (selectedPOI) => set({ selectedPOI }),

  setActiveProfile: (activeProfile) => {
    const { selectedDestination } = get();
    set({ activeProfile });
    if (selectedDestination) {
      get().setDestination(selectedDestination);
    }
  },

  startNavigation: () => {
    const { activeRoute } = get();
    if (!activeRoute) return;
    set({
      isNavigating: true,
      cameraMode: 'follow',
      currentStepIndex: 0,
    });
  },

  stopNavigation: () => {
    set({
      isNavigating: false,
      cameraMode: 'free',
      activeRoute: null,
      selectedDestination: null,
    });
  },

  clearNavigation: () => {
    set({
      activeRoute: null,
      selectedDestination: null,
      searchResults: [],
      isNavigating: false,
    });
  },

  updateNavigationProgress: (_location) => {
    // Placeholder for real GPS updates
  },
}));
