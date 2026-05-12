import { create } from "zustand";
import { GeocodingFeature, DirectionsResponse, mapService } from "@/modules/shared/api/map.service";
import { INITIAL_VIEW_STATE } from "../constants/config";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import length from "@turf/length";
import lineSlice from "@turf/line-slice";

export type TravelMode = "driving" | "walking" | "cycling";

export interface POIDetails {
  name: string;
  category: string;
  coordinates: [number, number];
}

interface MapState {
  origin: [number, number];
  userLocation: [number, number] | null;
  destination: GeocodingFeature | null;
  selectedPOI: POIDetails | null;
  searchResults: GeocodingFeature[];
  activeRoute: any | null;
  isSearching: boolean;
  isRouting: boolean;
  travelMode: TravelMode;
  showTraffic: boolean;
  showTerrain: boolean;
  map: any | null;
  deviceType: 'phone' | 'mirror';
  gpsStatus: 'good' | 'lost' | 'denied' | null;
  lastRouteFetchTime: number;
  
  // Navigation State
  isNavigating: boolean;
  currentStepIndex: number;
  distanceToNextManeuver: number;
  remainingDistance: number;
  remainingDuration: number;
  offRouteCounter: number;
  cameraMode: 'follow' | 'overview' | 'free';
  cameraPitch: number;
  cameraZoom: number;
  cameraBearing: number;
  userBearing: number;
  gpsSpeed: number | null;
  gpsHeading: number | null;
  
  // Actions
  setMap: (map: any) => void;
  setCameraMode: (mode: 'follow' | 'overview' | 'free') => void;
  setDeviceType: (type: 'phone' | 'mirror') => void;
  setGpsStatus: (status: 'good' | 'lost' | 'denied' | null) => void;
  setOrigin: (coords: [number, number]) => void;
  setUserLocation: (coords: [number, number] | null) => void;
  setDestination: (feature: GeocodingFeature | null) => void;
  setSelectedPOI: (poi: POIDetails | null) => void;
  setTravelMode: (mode: TravelMode) => void;
  toggleTraffic: () => void;
  toggleTerrain: () => void;
  searchLocations: (query: string) => Promise<void>;
  fetchRoute: (force?: boolean) => Promise<void>;
  clearNavigation: () => void;
  
  // Navigation Actions
  startNavigation: () => void;
  stopNavigation: () => void;
  updateNavigationProgress: (location: [number, number], speed?: number | null, heading?: number | null) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  origin: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
  userLocation: null,
  destination: null,
  selectedPOI: null,
  searchResults: [],
  activeRoute: null,
  isSearching: false,
  isRouting: false,
  travelMode: "driving",
  showTraffic: false,
  showTerrain: true,
  map: null,
  deviceType: 'phone',
  gpsStatus: null,
  lastRouteFetchTime: 0,

  // Navigation Defaults
  isNavigating: false,
  currentStepIndex: 0,
  distanceToNextManeuver: 0,
  remainingDistance: 0,
  remainingDuration: 0,
  offRouteCounter: 0,
  cameraMode: 'free',
  cameraPitch: 0,
  cameraZoom: 14,
  cameraBearing: 0,
  userBearing: 0,
  gpsSpeed: null,
  gpsHeading: null,

  setMap: (map) => set({ map }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setDeviceType: (deviceType) => set({ deviceType }),
  setGpsStatus: (gpsStatus) => set({ gpsStatus }),
  setSelectedPOI: (poi) => set({ selectedPOI: poi }),
  toggleTraffic: () => set((state) => ({ showTraffic: !state.showTraffic })),
  toggleTerrain: () => set((state) => ({ showTerrain: !state.showTerrain })),
  setOrigin: (origin) => set({ origin }),
  setUserLocation: (userLocation) => {
    set({ userLocation, origin: userLocation || get().origin });
  },
  setTravelMode: (travelMode) => {
    set({ travelMode });
    if (get().destination) {
      get().fetchRoute(true);
    }
  },

  setDestination: (destination) => {
    set({ destination, searchResults: [], selectedPOI: null });
    if (destination) {
      get().fetchRoute(true);
    }
  },

  searchLocations: async (query) => {
    if (!query) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    
    set({ isSearching: true });
    try {
      const { userLocation } = get();
      const results = await mapService.search(query, userLocation);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      console.error("Search error:", error);
      set({ isSearching: false });
    }
  },

  fetchRoute: async (force = false) => {
    const { origin, destination, travelMode, lastRouteFetchTime } = get();
    if (!destination) return;

    // Rate limit: do not fetch more than once per 5 seconds unless forced
    if (!force && Date.now() - lastRouteFetchTime < 5000) return;
    set({ lastRouteFetchTime: Date.now() });

    set({ isRouting: true });
    try {
      const routeData = await mapService.getDirections(origin, destination.center, travelMode);
      set({ activeRoute: routeData, isRouting: false });
      
      // If we are actively navigating and recalculating, re-initialize stats
      if (get().isNavigating && routeData && routeData.routes && routeData.routes[0]) {
         const r = routeData.routes[0];
         set({
           currentStepIndex: 0,
           remainingDistance: r.distance,
           remainingDuration: r.duration,
           distanceToNextManeuver: r.legs?.[0]?.steps?.[0]?.distance || 0,
           offRouteCounter: 0
         });
      }
    } catch (error) {
      console.error("Route error:", error);
      set({ isRouting: false });
    }
  },

  clearNavigation: () => {
    get().stopNavigation();
    set({ 
      destination: null, 
      activeRoute: null, 
      searchResults: [] 
    });
  },

  startNavigation: () => {
    const { activeRoute } = get();
    if (!activeRoute || !activeRoute.routes || !activeRoute.routes[0]) return;
    
    const r = activeRoute.routes[0];
    set({
      isNavigating: true,
      currentStepIndex: 0,
      remainingDistance: r.distance,
      remainingDuration: r.duration,
      distanceToNextManeuver: r.legs?.[0]?.steps?.[0]?.distance || 0,
      offRouteCounter: 0,
      cameraMode: 'follow',
      cameraPitch: 70,
      cameraZoom: 18.5
    });
  },

  stopNavigation: () => {
    set({
      isNavigating: false,
      currentStepIndex: 0,
      remainingDistance: 0,
      remainingDuration: 0,
      distanceToNextManeuver: 0,
      offRouteCounter: 0,
      cameraMode: 'free',
      cameraPitch: 0,
      cameraZoom: 14,
      cameraBearing: 0,
      userBearing: 0,
      gpsSpeed: null,
      gpsHeading: null
    });
  },

  updateNavigationProgress: (location, speed = null, heading = null) => {
    const { activeRoute, isNavigating, fetchRoute, offRouteCounter } = get();
    if (!isNavigating || !activeRoute || !activeRoute.routes || !activeRoute.routes[0]) return;

    const route = activeRoute.routes[0];
    const routeLine = route.geometry;
    if (!routeLine || routeLine.type !== 'LineString') return;

    const userPt = point(location);
    const endCoord = routeLine.coordinates[routeLine.coordinates.length - 1];
    
    // Off-route detection
    const nearest = nearestPointOnLine(routeLine, userPt, { units: 'meters' });
    const distToRoute = distance(userPt, nearest, { units: 'meters' });

    if (distToRoute > 50) { // 50 meters off-route tolerance
      const newCounter = offRouteCounter + 1;
      set({ offRouteCounter: newCounter });
      
      // Debounce: Trigger recalculation after 3 consecutive off-route readings
      if (newCounter >= 3) {
        set({ offRouteCounter: 0 });
        fetchRoute();
      }
      return; 
    } else {
      set({ offRouteCounter: 0 });
    }

    // Measure distance along the route
    const sliceToEnd = lineSlice(nearest, point(endCoord), routeLine);
    const remainingDistMeters = length(sliceToEnd, { units: 'meters' });
    
    const totalDist = route.distance;
    const totalDur = route.duration;
    
    // Ensure remaining dist is clamped properly
    const clampedRemainingDist = Math.max(0, Math.min(totalDist, remainingDistMeters));
    
    // Estimate remaining duration linearly based on remaining distance
    const progressRatio = totalDist > 0 ? (clampedRemainingDist / totalDist) : 0;
    const remainingDur = totalDur * progressRatio;

    const distFromStart = totalDist - clampedRemainingDist;
    const steps = route.legs?.[0]?.steps || [];
    
    let accumDist = 0;
    let stepIdx = 0;
    let distToNext = 0;

    for (let i = 0; i < steps.length; i++) {
      accumDist += steps[i].distance;
      if (distFromStart <= accumDist) {
        stepIdx = i;
        distToNext = accumDist - distFromStart;
        break;
      }
    }
    
    // Cap at the final step if we exceeded everything
    if (distFromStart > accumDist && steps.length > 0) {
        stepIdx = steps.length - 1;
        distToNext = 0;
    }

    set({
      currentStepIndex: stepIdx,
      distanceToNextManeuver: distToNext,
      remainingDistance: clampedRemainingDist,
      remainingDuration: remainingDur,
      userBearing: heading || get().userBearing,
      gpsSpeed: speed,
      gpsHeading: heading
    });
  }
}));
