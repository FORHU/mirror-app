import { create } from "zustand";
import type mapboxgl from "mapbox-gl";
import { DEVICE_MODE } from "@/modules/shared/config/device.config";
import {
  mapService,
  type NearbyPOI,
  type GeocodeResult,
  type DirectionsFormatted,
} from "../services/map.service";

interface SelectedPOI {
  name: string;
  category: string;
  address?: string;
  location: { lat: number; lng: number };
  layerId?: string;
  fsqId?: string;
  photo?: string | null;
}

type Destination = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
};

type Location = { lat: number; lng: number };

function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

interface MapStore {
  deviceMode: "mirror";
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map) => void;

  homeLocation: Location | null;
  homeLocationStatus: "idle" | "loading" | "loaded" | "error";
  workLocation: Location | null;

  mapStyle: "mirror" | "standard";
  cameraMode: "follow" | "overview" | "free";
  isNavigating: boolean;
  currentStepIndex: number;
  distanceToNextManeuver: number;
  remainingDistance: number;
  remainingDuration: number;
  activeRoute: DirectionsFormatted | null;
  lastTripGeojson: GeoJSON.FeatureCollection | null;

  searchResults: GeocodeResult[];
  isSearching: boolean;
  selectedDestination: Destination | null;
  nearbyPOIs: NearbyPOI[];
  selectedPOI: SelectedPOI | null;
  activeProfile: "car" | "motorcycle" | "bicycle" | "walking";
  showTraffic: boolean;
  showTerrain: boolean;
  isRouting: boolean;
  userLocation: Location | null;
  origin: Location | null;

  fetchNearbyPOIs: (destination: { lat: number; lng: number }) => Promise<void>;

  commuteEta: {
    duration: number;
    distance: number;
    to: "work" | "home";
  } | null;
  commuteEtaLoading: boolean;

  loadHomeLocation(): Promise<void>;
  saveHomeLocation(coords: Location): Promise<void>;
  setWorkLocation(coords: Location): void;
  clearWorkLocation(): void;
  setUserLocation(coords: Location): void;
  setCameraMode(mode: "follow" | "overview" | "free"): void;
  toggleMapStyle(): void;
  toggleTraffic(): void;
  toggleTerrain(): void;
  searchLocations(query: string): Promise<void>;
  setDestination(location: Destination): Promise<void>;
  setSelectedPOI(poi: SelectedPOI | null): void;
  setNearbyPOIs(pois: NearbyPOI[]): void;
  setActiveProfile(profile: "car" | "motorcycle" | "bicycle" | "walking"): void;
  fetchRoute(force?: boolean): Promise<void>;
  startNavigation(): void;
  stopNavigation(): void;
  clearNavigation(): void;
  updateNavigationProgress(location: Location): void;
  fetchCommuteEta(): Promise<void>;
}

export const useMapStore = create<MapStore>((set, get) => ({
  deviceMode: DEVICE_MODE as "mirror",
  map: null,
  setMap: (map) => set({ map }),

  homeLocation: null,
  homeLocationStatus: "idle",
  workLocation: loadFromStorage<Location>("mirror_work_location"),

  mapStyle: "mirror",
  cameraMode: "free",
  isNavigating: false,
  currentStepIndex: 0,
  distanceToNextManeuver: 0,
  remainingDistance: 0,
  remainingDuration: 0,
  activeRoute: null,
  lastTripGeojson: loadFromStorage("mirror_last_trip"),

  searchResults: [],
  isSearching: false,
  selectedDestination: null,
  nearbyPOIs: [],
  selectedPOI: null,
  activeProfile: "car",
  showTraffic: false,
  showTerrain: false,
  isRouting: false,
  userLocation: null,
  origin: null,

  setNearbyPOIs: (nearbyPOIs) => set({ nearbyPOIs }),
  fetchNearbyPOIs: async ({ lat, lng }) => {
    try {
      const { pois } = await mapService.nearbyPOIs(lat, lng, 1000);
      set({ nearbyPOIs: pois });
    } catch {
      // silently ignore — POIs are non-critical
    }
  },

  commuteEta: null,
  commuteEtaLoading: false,

  loadHomeLocation: async () => {
    set({ homeLocationStatus: "loading" });
    try {
      const data = await mapService.getHomeLocation();
      set({
        homeLocation: data.homeLocation,
        userLocation: data.homeLocation,
        origin: data.homeLocation,
        homeLocationStatus: "loaded",
      });
    } catch {
      set({ homeLocationStatus: "error" });
    }
  },

  saveHomeLocation: async (coords) => {
    set({ homeLocationStatus: "loading" });
    try {
      await mapService.setHomeLocation(coords);
      set({
        homeLocation: coords,
        userLocation: coords,
        origin: coords,
        homeLocationStatus: "loaded",
      });
    } catch {
      set({ homeLocationStatus: "error" });
    }
  },

  setWorkLocation: (coords) => {
    saveToStorage("mirror_work_location", coords);
    set({ workLocation: coords });
  },

  clearWorkLocation: () => {
    if (typeof window !== "undefined")
      localStorage.removeItem("mirror_work_location");
    set({ workLocation: null, commuteEta: null });
  },

  setUserLocation: (coords) => set({ userLocation: coords }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleMapStyle: () =>
    set((s) => ({ mapStyle: s.mapStyle === "mirror" ? "standard" : "mirror" })),
  toggleTraffic: () => set((s) => ({ showTraffic: !s.showTraffic })),
  toggleTerrain: () => set((s) => ({ showTerrain: !s.showTerrain })),

  searchLocations: async (query) => {
    set({ isSearching: true });
    try {
      const { userLocation, homeLocation } = get();
      const proximity = userLocation ?? homeLocation ?? undefined;
      const data = await mapService.geocode(query, proximity);
      set({ searchResults: data.results, isSearching: false });
    } catch {
      set({ isSearching: false });
    }
  },

  fetchRoute: async () => {
    const { selectedDestination, homeLocation, activeProfile } = get();
    if (!selectedDestination || !homeLocation) return;
    set({ isRouting: true });
    try {
      const route = await mapService.directions(
        [homeLocation.lng, homeLocation.lat],
        [selectedDestination.lng, selectedDestination.lat],
        activeProfile,
      );
      set({
        activeRoute: route,
        remainingDistance: route.distance,
        remainingDuration: route.duration,
        isRouting: false,
      });
    } catch {
      set({ isRouting: false });
    }
  },

  setDestination: async (location) => {
    set({
      selectedDestination: location,
      isSearching: false,
      searchResults: [],
    });
    get().fetchRoute();
    if (location)
      get().fetchNearbyPOIs({ lat: location.lat, lng: location.lng });
  },

  setSelectedPOI: (selectedPOI) => set({ selectedPOI }),

  setActiveProfile: (activeProfile) => {
    set({ activeProfile });
    const dest = get().selectedDestination;
    if (dest) get().setDestination(dest);
  },

  startNavigation: () => {
    if (!get().activeRoute) return;
    set({ isNavigating: true, cameraMode: "follow", currentStepIndex: 0 });
  },

  stopNavigation: () => {
    const { activeRoute } = get();
    if (activeRoute?.geojson) {
      saveToStorage("mirror_last_trip", activeRoute.geojson);
      set({ lastTripGeojson: activeRoute.geojson });
    }
    set({
      isNavigating: false,
      cameraMode: "free",
      activeRoute: null,
      selectedDestination: null,
      nearbyPOIs: [],
    });
  },

  clearNavigation: () => {
    set({
      activeRoute: null,
      selectedDestination: null,
      searchResults: [],
      isNavigating: false,
      nearbyPOIs: [],
    });
  },

  updateNavigationProgress: () => {},

  fetchCommuteEta: async () => {
    const { workLocation, homeLocation, userLocation, activeProfile } = get();
    const origin = userLocation ?? homeLocation;
    if (!origin) return;

    const hour = new Date().getHours();
    const isMorning = hour >= 6 && hour < 11;
    const isEvening = hour >= 17 && hour < 22;

    let destination: Location | null = null;
    let to: "work" | "home" = "work";

    if (isMorning && workLocation) {
      destination = workLocation;
      to = "work";
    } else if (isEvening && homeLocation) {
      destination = homeLocation;
      to = "home";
    }

    if (!destination) return;

    set({ commuteEtaLoading: true });
    try {
      const route = await mapService.directions(
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
        activeProfile,
      );
      set({
        commuteEta: { duration: route.duration, distance: route.distance, to },
        commuteEtaLoading: false,
      });
    } catch {
      set({ commuteEtaLoading: false });
    }
  },
}));
