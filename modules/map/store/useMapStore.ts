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
import { outlineService } from "@/modules/shared/api/outline.service";

export interface ItineraryGroup {
  label: string;
  stops: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
    placeId?: string;
    eventType?: string;
    timeBlock?: string;
  }[];
}

const EVENT_TYPE_TO_POI_CATEGORY: Record<string, string> = {
  lunch: "restaurant",
  dinner: "restaurant",
  breakfast: "cafe",
  meeting: "cafe",
  conference: "cafe",
  date: "restaurant",
  event: "restaurant",
  party: "restaurant",
};

// Infer a nearby-POI category from a stop's resolved place name when no
// explicit event type was provided. Covers common visitor destinations so that,
// e.g., a church stop surfaces nearby restaurants and a school stop surfaces
// cafes without the user needing to say "for lunch".
function inferCategoryFromName(name: string): string | undefined {
  const n = name.toLowerCase();
  if (
    /\b(church|chapel|cathedral|basilica|shrine|parish|convent|monastery|grotto)\b/.test(
      n,
    )
  )
    return "restaurant";
  if (/\b(university|college|school|academy|institute|campus)\b/.test(n))
    return "cafe";
  if (/\b(hospital|clinic|medical center|health center)\b/.test(n))
    return "pharmacy";
  if (/\b(mall|supermarket|department store|grocery)\b/.test(n))
    return "restaurant";
  if (/\b(park|garden|plaza|square|grounds)\b/.test(n)) return "cafe";
  if (/\b(market|public market|night market|tiangge|palengke)\b/.test(n))
    return "restaurant";
  if (/\b(museum|gallery|cultural center|heritage)\b/.test(n)) return "cafe";
  if (/\b(hotel|resort|inn|lodge|hostel)\b/.test(n)) return "restaurant";
  if (
    /\b(farm|eco-park|ecopark|agritourism|viewpoint|view point|lookout|vista|overlook)\b/.test(
      n,
    )
  )
    return "cafe";
  if (/\b(terminal|station|port|pier|airport)\b/.test(n)) return "restaurant";
  return undefined;
}

// Shared helper — fetches routes + POIs for a set of stops from a given origin
async function fetchRoutesAndPOIs(
  stops: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
    placeId?: string;
    eventType?: string;
    timeBlock?: string;
  }[],
  origin: { lat: number; lng: number },
  profile: "car" | "motorcycle" | "bicycle" | "walking",
): Promise<{
  routes: DirectionsFormatted[];
  pois: { stopIndex: number; pois: NearbyPOI[] }[];
}> {
  const allPoints = [origin, ...stops];
  const routes: DirectionsFormatted[] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    try {
      const route = await mapService.directions(
        [allPoints[i].lng, allPoints[i].lat],
        [allPoints[i + 1].lng, allPoints[i + 1].lat],
        profile,
      );
      routes.push(route);
    } catch {
      /* skip failed legs */
    }
  }
  const pois = await Promise.all(
    stops.map(async (stop, i) => {
      try {
        const category =
          (stop.eventType
            ? EVENT_TYPE_TO_POI_CATEGORY[stop.eventType]
            : undefined) ?? inferCategoryFromName(stop.name);
        const { pois } = await mapService.nearbyPOIs(
          stop.lat,
          stop.lng,
          600,
          category,
        );
        return { stopIndex: i, pois: pois.slice(0, 5) };
      } catch {
        return { stopIndex: i, pois: [] };
      }
    }),
  );
  return { routes, pois };
}

// Returns the correct starting point for an itinerary group:
// group 0 uses user/home location; group N uses the last stop of group N-1.
function groupOrigin(
  groupIndex: number,
  groups: ItineraryGroup[],
  userLoc: { lat: number; lng: number } | null,
  homeLoc: { lat: number; lng: number } | null,
): { lat: number; lng: number } {
  if (groupIndex > 0 && groups[groupIndex - 1]?.stops.length > 0) {
    const prev = groups[groupIndex - 1].stops;
    return prev[prev.length - 1];
  }
  return userLoc ?? homeLoc ?? { lat: 0, lng: 0 };
}

interface SelectedPOI {
  name: string;
  category: string;
  address?: string;
  distance?: number;
  location: { lat: number; lng: number };
  layerId?: string;
  placeId?: string;
  photo?: string | null;
  travelFromStop?: { walkingMin: number; carMin: number };
}

type Destination = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
  eventType?: string;
  timeBlock?: string;
};

type Location = { lat: number; lng: number };

interface MapStore {
  deviceMode: "mirror";
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map) => void;

  isPanning: boolean;
  setIsPanning: (v: boolean) => void;

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
  itineraryStopPOIs: { stopIndex: number; pois: NearbyPOI[] }[];
  itineraryGroups: ItineraryGroup[];
  activeItineraryIndex: number;
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
  setItineraryStopPOIs(data: { stopIndex: number; pois: NearbyPOI[] }[]): void;
  addItineraryGroup(stops: Destination[], label?: string): Promise<void>;
  setActiveItineraryIndex(index: number): Promise<void>;
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
  loadOutlineStops: () => Promise<void>;
  clearItinerary: () => Promise<void>;
}

export const useMapStore = create<MapStore>((set, get) => ({
  deviceMode: DEVICE_MODE as "mirror",
  map: null,
  setMap: (map) => set({ map }),

  isPanning: false,
  setIsPanning: (v) => set({ isPanning: v }),

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
  itineraryStopPOIs: [],
  itineraryGroups: [],
  activeItineraryIndex: 0,
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
    try {
      await mapService.setHomeLocation(coords);
      set({ homeLocation: coords, userLocation: coords, origin: coords });
    } catch {
      // silently ignore — home location save is best-effort,
      // do NOT touch homeLocationStatus (would unmount MapDashboard)
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

  setItineraryStopPOIs: (data) => set({ itineraryStopPOIs: data }),

  setItineraryStops: async (stops) => {
    const {
      itineraryGroups,
      activeItineraryIndex,
      userLocation,
      homeLocation,
      activeProfile,
    } = get();

    // Sync with itineraryGroups — create group 0 if first time, otherwise update active group
    let groups: ItineraryGroup[];
    let groupIdx: number;
    if (itineraryGroups.length === 0) {
      groups = [{ label: "Leg 1", stops }];
      groupIdx = 0;
    } else {
      groups = [...itineraryGroups];
      groups[activeItineraryIndex] = { ...groups[activeItineraryIndex], stops };
      groupIdx = activeItineraryIndex;
    }

    set({
      itineraryGroups: groups,
      activeItineraryIndex: groupIdx,
      itineraryStops: stops,
      itineraryRoutes: [],
      itineraryStopPOIs: [],
      selectedDestination: null,
      activeRoute: null,
    });

    if (stops.length === 0) return;
    const origin = groupOrigin(groupIdx, groups, userLocation, homeLocation);
    const { routes, pois } = await fetchRoutesAndPOIs(
      stops,
      origin,
      activeProfile,
    );
    set({ itineraryRoutes: routes, itineraryStopPOIs: pois });
    // Persist stops to DB so loadOutlineStops can restore them on next page load
    outlineService.saveMapStops(stops).catch(() => {});
  },

  addItineraryGroup: async (stops, label) => {
    const { itineraryGroups, userLocation, homeLocation, activeProfile } =
      get();
    const newLabel = label ?? `Leg ${itineraryGroups.length + 1}`;
    const newGroups = [...itineraryGroups, { label: newLabel, stops }];
    const newIndex = newGroups.length - 1;

    set({
      itineraryGroups: newGroups,
      activeItineraryIndex: newIndex,
      itineraryStops: stops,
      itineraryRoutes: [],
      itineraryStopPOIs: [],
      selectedDestination: null,
      activeRoute: null,
    });

    if (stops.length === 0) return;
    const origin = groupOrigin(newIndex, newGroups, userLocation, homeLocation);
    const { routes, pois } = await fetchRoutesAndPOIs(
      stops,
      origin,
      activeProfile,
    );
    set({ itineraryRoutes: routes, itineraryStopPOIs: pois });
    outlineService.saveMapStops(stops).catch(() => {});
  },

  setActiveItineraryIndex: async (index) => {
    const { itineraryGroups, userLocation, homeLocation, activeProfile } =
      get();
    if (index < 0 || index >= itineraryGroups.length) return;

    const stops = itineraryGroups[index].stops;
    set({
      activeItineraryIndex: index,
      itineraryStops: stops,
      itineraryRoutes: [],
      itineraryStopPOIs: [],
      selectedDestination: null,
      activeRoute: null,
    });

    if (stops.length === 0) return;
    const origin = groupOrigin(
      index,
      itineraryGroups,
      userLocation,
      homeLocation,
    );
    const { routes, pois } = await fetchRoutesAndPOIs(
      stops,
      origin,
      activeProfile,
    );
    set({ itineraryRoutes: routes, itineraryStopPOIs: pois });
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
      itineraryStopPOIs: [],
      itineraryGroups: [],
      activeItineraryIndex: 0,
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

  setActiveProfile: async (activeProfile) => {
    set({ activeProfile });
    const {
      selectedDestination,
      itineraryStops,
      itineraryGroups,
      activeItineraryIndex,
      userLocation,
      homeLocation,
    } = get();
    if (selectedDestination) {
      get().setDestination(selectedDestination);
    } else if (itineraryStops.length > 0) {
      const origin = groupOrigin(
        activeItineraryIndex,
        itineraryGroups,
        userLocation,
        homeLocation,
      );
      const { routes } = await fetchRoutesAndPOIs(
        itineraryStops,
        origin,
        activeProfile,
      );
      set({ itineraryRoutes: routes });
    }
  },

  patchHomeLocation: async (coords) => {
    await mapService.setHomeLocation(coords);
    set({ homeLocation: coords, origin: coords });
  },

  loadOutlineStops: async () => {
    const { itineraryGroups, userLocation, homeLocation } = get();

    if (itineraryGroups.length > 0) {
      console.log(
        "[loadOutlineStops] skipped — itinerary already has stops:",
        itineraryGroups,
      );
      return;
    }

    console.log("[loadOutlineStops] fetching active outline...");
    try {
      const outline = await outlineService.getActive();

      if (!outline) {
        console.log("[loadOutlineStops] no active outline found");
        return;
      }
      console.log("[loadOutlineStops] outline found:", {
        id: outline.id,
        eventCount: outline.events?.length ?? 0,
      });

      if (!outline.events?.length) {
        console.log("[loadOutlineStops] outline has no events");
        return;
      }

      const eventsWithDest = outline.events.filter((e) => !!e.routeDestination);
      console.log(
        "[loadOutlineStops] events with routeDestination:",
        eventsWithDest.map((e) => ({
          type: e.type,
          timeBlock: e.timeBlock,
          routeDestination: e.routeDestination,
        })),
      );

      const userLoc = userLocation ?? homeLocation ?? undefined;

      const resolved = await Promise.all(
        eventsWithDest.map(async (e) => {
          try {
            const { results } = await mapService.geocode(
              e.routeDestination!,
              userLoc,
            );
            if (!results.length) {
              console.warn(
                "[loadOutlineStops] geocode returned no results for:",
                e.routeDestination,
              );
              return null;
            }
            console.log(
              "[loadOutlineStops] geocoded:",
              e.routeDestination,
              "→",
              results[0].lat,
              results[0].lng,
            );
            return {
              name: e.routeDestination!,
              address: results[0].address,
              lat: results[0].lat,
              lng: results[0].lng,
              placeId: results[0].placeId,
            };
          } catch (err) {
            console.warn(
              "[loadOutlineStops] geocode failed for:",
              e.routeDestination,
              err,
            );
            return null;
          }
        }),
      );

      const stops = resolved.filter(
        (s): s is NonNullable<typeof s> => s !== null,
      );
      console.log("[loadOutlineStops] resolved stops:", stops);

      if (!stops.length) {
        console.log("[loadOutlineStops] no stops resolved after geocoding");
        return;
      }

      await get().setItineraryStops(stops);
      console.log(
        "[loadOutlineStops] itinerary set with",
        stops.length,
        "stop(s)",
      );
    } catch (err) {
      console.error("[loadOutlineStops] unexpected error:", err);
    }
  },

  clearItinerary: async () => {
    set({
      itineraryStops: [],
      itineraryGroups: [],
      itineraryRoutes: [],
      itineraryStopPOIs: [],
      activeItineraryIndex: 0,
      selectedDestination: null,
      activeRoute: null,
    });
    outlineService.saveMapStops([]).catch(() => {});
  },
}));
