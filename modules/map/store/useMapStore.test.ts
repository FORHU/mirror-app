import { vi, describe, it, expect, beforeEach } from "vitest";
import type { DirectionsFormatted } from "@/modules/map/services/map.service";

// Mock external services before the store module is imported
vi.mock("@/modules/map/services/map.service", () => ({
  mapService: {
    directions: vi.fn(),
    getHomeLocation: vi.fn(),
    setHomeLocation: vi.fn(),
    geocode: vi.fn(),
    nearbyPOIs: vi.fn(),
    tts: vi.fn(),
  },
}));

vi.mock("@/modules/shared/api/outline.service", () => ({
  outlineService: {
    getActive: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    getOrCreate: vi.fn(),
    getActiveWithStops: vi.fn(),
    getStops: vi.fn(),
  },
}));

// Imported after mocks are registered
import { useMapStore } from "./useMapStore";
import { mapService } from "@/modules/map/services/map.service";

const ORIGIN = { lat: 16.41, lng: 120.59 };
const DEST = {
  name: "Baguio Cathedral",
  lat: 16.406,
  lng: 120.596,
  address: "Test",
  placeId: "p1",
  placeType: "place",
};

function makeRoute(distance: number, duration: number): DirectionsFormatted {
  return {
    geojson: { type: "FeatureCollection", features: [] },
    steps: [],
    distance,
    duration,
  };
}

function resetStoreForRouting() {
  useMapStore.setState({
    homeLocation: ORIGIN,
    userLocation: null,
    selectedDestination: DEST,
    activeProfile: "car",
    activeRoute: null,
    routeDistance: 0,
    routeDuration: 0,
    isRouting: false,
    itineraryStops: [],
  });
}

describe("fetchRoute", () => {
  beforeEach(() => {
    resetStoreForRouting();
    vi.clearAllMocks();
  });

  it("writes distance and duration when profile matches", async () => {
    vi.mocked(mapService.directions).mockResolvedValue(makeRoute(5000, 600));

    await useMapStore.getState().fetchRoute();

    expect(useMapStore.getState().routeDistance).toBe(5000);
    expect(useMapStore.getState().routeDuration).toBe(600);
    expect(useMapStore.getState().isRouting).toBe(false);
  });

  it("sets isRouting=false on error when profile still matches", async () => {
    vi.mocked(mapService.directions).mockRejectedValue(
      new Error("Network error"),
    );

    await useMapStore.getState().fetchRoute();

    expect(useMapStore.getState().isRouting).toBe(false);
  });

  it("does nothing when selectedDestination is null", async () => {
    useMapStore.setState({ selectedDestination: null });

    await useMapStore.getState().fetchRoute();

    expect(mapService.directions).not.toHaveBeenCalled();
  });

  it("does nothing when origin (home + user location) is null", async () => {
    useMapStore.setState({ homeLocation: null, userLocation: null });

    await useMapStore.getState().fetchRoute();

    expect(mapService.directions).not.toHaveBeenCalled();
  });

  // ── BG-9: stale-profile guard ────────────────────────────────────────────

  it("discards stale result when profile changes before response arrives", async () => {
    let resolveCarRoute!: (r: DirectionsFormatted) => void;
    const carRoute = makeRoute(5000, 600);
    const bikeRoute = makeRoute(6000, 1200);

    vi.mocked(mapService.directions)
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveCarRoute = res;
          }), // car: blocked
      )
      .mockResolvedValueOnce(bikeRoute); // bicycle: instant

    // Start car route fetch (won't resolve yet)
    const carFetch = useMapStore.getState().fetchRoute();

    // User switches to bicycle before the car response arrives
    useMapStore.setState({ activeProfile: "bicycle" });

    // Bicycle fetch resolves immediately
    await useMapStore.getState().fetchRoute();
    expect(useMapStore.getState().routeDistance).toBe(6000);
    expect(useMapStore.getState().routeDuration).toBe(1200);

    // Now let the stale car response arrive
    resolveCarRoute(carRoute);
    await carFetch;

    // Car result must NOT overwrite the bicycle result
    expect(useMapStore.getState().routeDistance).toBe(6000);
    expect(useMapStore.getState().routeDuration).toBe(1200);
    expect(useMapStore.getState().activeProfile).toBe("bicycle");
  });

  it("does NOT set isRouting=false for a stale error", async () => {
    let rejectCarRoute!: (e: Error) => void;
    const bikeRoute = makeRoute(6000, 1200);

    vi.mocked(mapService.directions)
      .mockImplementationOnce(
        () =>
          new Promise((_, rej) => {
            rejectCarRoute = rej;
          }), // car: blocked on error
      )
      .mockResolvedValueOnce(bikeRoute);

    const carFetch = useMapStore.getState().fetchRoute();

    useMapStore.setState({ activeProfile: "bicycle" });
    await useMapStore.getState().fetchRoute();

    // Bike route landed; isRouting should already be false from the bike fetch
    expect(useMapStore.getState().isRouting).toBe(false);

    // Stale car request fails — should not re-set isRouting or overwrite state
    rejectCarRoute(new Error("stale error"));
    await carFetch;

    expect(useMapStore.getState().routeDistance).toBe(6000);
    expect(useMapStore.getState().isRouting).toBe(false);
  });
});
