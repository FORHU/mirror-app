import { create } from "zustand";
import type mapboxgl from "mapbox-gl";
import { DEVICE_MODE } from "@/modules/shared/config/device.config";
import {
  mapService,
  type NearbyPOI,
  type GeocodeResult,
  type DirectionsFormatted,
} from "../services/map.service";
import type { PendingEvent } from "@/modules/shared/ai/chatwonder.types";

interface SelectedPOI {
  name: string;
  category: string;
  address?: string;
  distance?: number;
  location: { lat: number; lng: number };
  layerId?: string;
  placeId?: string;
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

interface MapStore {
  deviceMode: "mirror";
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map) => void;

  homeLocation: Location | null;
  homeLocationStatus: "idle" | "loading" | "loaded" | "error";

  mapStyle: "mirror" | "standard";
  cameraMode: "overview" | "free";
  routeDistance: number;
  routeDuration: number;
  activeRoute: DirectionsFormatted | null;

  searchResults: GeocodeResult[];
  isSearching: boolean;
  selectedDestination: Destination | null;
  nearbyPOIs: NearbyPOI[];
  suggestedPOIs: NearbyPOI[];
  suggestionLabel: string;
  selectedPOI: SelectedPOI | null;
  activeProfile: "car" | "motorcycle" | "bicycle" | "walking";
  showTraffic: boolean;
  isRouting: boolean;
  userLocation: Location | null;
  origin: Location | null;

  itineraryStops: Destination[];
  itineraryRoutes: DirectionsFormatted[];
  pendingEvents: PendingEvent[];

  fetchNearbyPOIs: (destination: { lat: number; lng: number }) => Promise<void>;

  loadHomeLocation(): Promise<void>;
  saveHomeLocation(coords: Location): Promise<void>;
  setUserLocation(coords: Location): void;
  setCameraMode(mode: "overview" | "free"): void;
  toggleMapStyle(): void;
  toggleTraffic(): void;
  searchLocations(query: string): Promise<void>;
  setDestination(location: Destination): Promise<void>;
  setItineraryStops(stops: Destination[]): Promise<void>;
  setSelectedPOI(poi: SelectedPOI | null): void;
  setNearbyPOIs(pois: NearbyPOI[]): void;
  setSuggestedPOIs(pois: NearbyPOI[], label: string): void;
  clearSuggestions(): void;
  setActiveProfile(profile: "car" | "motorcycle" | "bicycle" | "walking"): void;
  fetchRoute(force?: boolean): Promise<void>;
  clearRoute(): void;
  patchHomeLocation(coords: Location): Promise<void>;
  setPendingEvents: (events: PendingEvent[]) => void;
  clearPendingEvents: () => void;
}

export const useMapStore = create<MapStore>((set, get) => ({
  deviceMode: DEVICE_MODE as "mirror",
  map: null,
  setMap: (map) => set({ map }),

  homeLocation: null,
  homeLocationStatus: "idle",

  mapStyle: "mirror",
  cameraMode: "overview",
  routeDistance: 0,
  routeDuration: 0,
  activeRoute: null,

  searchResults: [],
  isSearching: false,
  selectedDestination: null,
  nearbyPOIs: [],
  suggestedPOIs: [],
  suggestionLabel: "",
  selectedPOI: null,
  activeProfile: "car",
  showTraffic: false,
  isRouting: false,
  userLocation: null,
  origin: null,
  itineraryStops: [],
  itineraryRoutes: [],
  pendingEvents: [],

  setPendingEvents: (events) => set({ pendingEvents: events }),
  clearPendingEvents: () => set({ pendingEvents: [] }),

  setNearbyPOIs: (nearbyPOIs) => set({ nearbyPOIs }),
  setSuggestedPOIs: (pois, label) =>
    set({ suggestedPOIs: pois, suggestionLabel: label }),
  clearSuggestions: () => set({ suggestedPOIs: [], suggestionLabel: "" }),
  fetchNearbyPOIs: async ({ lat, lng }) => {
    try {
      const { pois } = await mapService.nearbyPOIs(lat, lng, 1000);
      set({ nearbyPOIs: pois });
    } catch {
      // silently ignore — POIs are non-critical
    }
  },

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

  setUserLocation: (coords) => set({ userLocation: coords }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleMapStyle: () =>
    set((s) => ({ mapStyle: s.mapStyle === "mirror" ? "standard" : "mirror" })),
  toggleTraffic: () => set((s) => ({ showTraffic: !s.showTraffic })),

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
    const { selectedDestination, homeLocation, userLocation, activeProfile } =
      get();
    const origin = userLocation ?? homeLocation;
    if (!selectedDestination || !origin) return;
    set({ isRouting: true });
    try {
      const route = await mapService.directions(
        [origin.lng, origin.lat],
        [selectedDestination.lng, selectedDestination.lat],
        activeProfile,
      );
      set({
        activeRoute: route,
        routeDistance: route.distance,
        routeDuration: route.duration,
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
      itineraryStops: [],
      itineraryRoutes: [],
    });
    get().fetchRoute();
  },

  setItineraryStops: async (stops) => {
    set({
      itineraryStops: stops,
      itineraryRoutes: [],
      selectedDestination: null,
      activeRoute: null,
    });
    const { userLocation, homeLocation, activeProfile } = get();
    const origin = userLocation ?? homeLocation;
    if (!origin || stops.length === 0) return;

    const allPoints = [{ lat: origin.lat, lng: origin.lng }, ...stops];
    const routes: DirectionsFormatted[] = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      try {
        const route = await mapService.directions(
          [allPoints[i].lng, allPoints[i].lat],
          [allPoints[i + 1].lng, allPoints[i + 1].lat],
          activeProfile,
        );
        routes.push(route);
      } catch {
        // skip failed legs silently
      }
    }
    set({ itineraryRoutes: routes });
  },

  clearRoute: () => {
    set({
      activeRoute: null,
      selectedDestination: null,
      routeDistance: 0,
      routeDuration: 0,
      nearbyPOIs: [],
      suggestedPOIs: [],
      showTraffic: false,
      cameraMode: "overview",
      itineraryStops: [],
      itineraryRoutes: [],
    });
  },

  setSelectedPOI: (selectedPOI) => {
    set({ selectedPOI });
    if (!selectedPOI) return;

    const fetchAndSetPhoto = (placeId: string) => {
      mapService
        .venuePhotos(placeId)
        .then(({ photos }) => {
          if (photos.length > 0) {
            set((s) => {
              if (s.selectedPOI && s.selectedPOI.placeId === placeId) {
                return { selectedPOI: { ...s.selectedPOI, photo: photos[0] } };
              }
              return {};
            });
          }
        })
        .catch(() => {});
    };

    if (selectedPOI.placeId) {
      fetchAndSetPhoto(selectedPOI.placeId);
    } else {
      const { lat, lng } = selectedPOI.location;
      mapService
        .nearbyPOIs(lat, lng, 300)
        .then(({ pois }) => {
          const clickedName = selectedPOI.name.toLowerCase();
          const match = pois.find((p) => {
            const n = p.name.toLowerCase();
            return n.includes(clickedName) || clickedName.includes(n);
          });
          if (match?.placeId) {
            set((s) => {
              if (s.selectedPOI && s.selectedPOI.name === selectedPOI.name) {
                return {
                  selectedPOI: {
                    ...s.selectedPOI,
                    placeId: match.placeId,
                    photo: match.photo ?? null,
                  },
                };
              }
              return {};
            });
            fetchAndSetPhoto(match.placeId);
          }
        })
        .catch(() => {});
    }
  },

  setActiveProfile: (activeProfile) => {
    set({ activeProfile });
    const dest = get().selectedDestination;
    if (dest) get().setDestination(dest);
  },

  patchHomeLocation: async (coords) => {
    await mapService.setHomeLocation(coords);
    set({ homeLocation: coords, origin: coords });
  },
}));
