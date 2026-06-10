import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NearbyPOI } from "@/modules/map/services/map.service";

// ── Mocks ──────────────────────────────────────────────────────────────────

const setSuggestedPOIs = vi.fn();
const mockMapState: {
  userLocation: { lat: number; lng: number } | null;
  homeLocation: { lat: number; lng: number } | null;
  selectedDestination: { lat: number; lng: number; name: string } | null;
} = {
  userLocation: { lat: 16.41, lng: 120.59 },
  homeLocation: null,
  selectedDestination: null,
};

vi.mock("@/modules/map/store/useMapStore", () => ({
  useMapStore: {
    getState: () => ({ ...mockMapState, setSuggestedPOIs }),
  },
}));

vi.mock("@/modules/shared/store/useCalendarStore", () => ({
  useCalendarStore: { getState: () => ({ addEvent: vi.fn() }) },
}));

vi.mock("@/modules/shared/store/useMirrorStore", () => ({
  useMirrorStore: {
    getState: () => ({ setAiSuggestion: vi.fn(), clearAiSuggestion: vi.fn() }),
  },
}));

const mockNearbyPOIs = vi.fn();
const mockTts = vi.fn();

vi.mock("@/modules/map/services/map.service", () => ({
  mapService: {
    nearbyPOIs: mockNearbyPOIs,
    geocode: vi.fn().mockResolvedValue({ results: [] }),
    tts: mockTts,
  },
}));

vi.mock("@/navigation", () => ({
  ROUTES: { WELCOME: "/", MAP: "/map" },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const makePOI = (name: string): NearbyPOI => ({
  placeId: `place-${name}`,
  name,
  category: "cafe",
  categoryIcon: "☕",
  lat: 16.41,
  lng: 120.59,
  address: "Session Road, Baguio",
  photo: null,
  rating: 4.5,
  userRatingsTotal: 100,
  distance: 200,
});

const fakeRouter = { push: vi.fn() } as never;

// ── Tests ──────────────────────────────────────────────────────────────────

describe("executeAction — maps_suggest_places", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMapState.userLocation = { lat: 16.41, lng: 120.59 };
    mockMapState.selectedDestination = null;
    mockMapState.homeLocation = null;
  });

  // ── Tracer bullet: POIs are fetched and stored ─────────────────────────

  it("fetches nearby POIs and updates the map store", async () => {
    const pois = [makePOI("Starbucks"), makePOI("Bo's Coffee")];
    mockNearbyPOIs.mockResolvedValueOnce({ pois });

    const { executeAction } = await import("./actionExecutor");
    await executeAction(
      { type: "maps_suggest_places", category: "coffee", label: "Coffee shops" },
      fakeRouter,
      "/map",
    );

    // Give the fire-and-forget promise time to resolve
    await vi.waitFor(() => expect(setSuggestedPOIs).toHaveBeenCalled());

    expect(mockNearbyPOIs).toHaveBeenCalledWith(16.41, 120.59, 1500, "cafe");
    expect(setSuggestedPOIs).toHaveBeenCalledWith(pois, "Coffee shops");
  });

  // ── Category mapping ───────────────────────────────────────────────────

  it.each([
    ["food", "restaurant"],
    ["coffee", "cafe"],
    ["activities", "attraction"],
    ["shopping", "shop"],
    ["medical", "medical"],
    ["transit", "transit"],
  ])(
    "maps ChatWonder category '%s' to Google Places category '%s'",
    async (chatWonderCategory, googleCategory) => {
      mockNearbyPOIs.mockResolvedValueOnce({ pois: [] });

      const { executeAction } = await import("./actionExecutor");
      await executeAction(
        {
          type: "maps_suggest_places",
          category: chatWonderCategory as never,
          label: "Places",
        },
        fakeRouter,
        "/map",
      );

      await vi.waitFor(() => expect(mockNearbyPOIs).toHaveBeenCalled());
      expect(mockNearbyPOIs).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        googleCategory,
      );
    },
  );

  // ── No location → no-op ────────────────────────────────────────────────

  it("does nothing when no location is available", async () => {
    mockMapState.userLocation = null;
    mockMapState.homeLocation = null;
    mockMapState.selectedDestination = null;

    const { executeAction } = await import("./actionExecutor");
    await executeAction(
      { type: "maps_suggest_places", category: "food", label: "Restaurants" },
      fakeRouter,
      "/map",
    );

    expect(mockNearbyPOIs).not.toHaveBeenCalled();
  });

  // ── selectedDestination takes priority over userLocation ───────────────

  it("uses selectedDestination location when available", async () => {
    mockMapState.selectedDestination = { lat: 14.59, lng: 120.98, name: "Manila" } as never;
    mockNearbyPOIs.mockResolvedValueOnce({ pois: [] });

    const { executeAction } = await import("./actionExecutor");
    await executeAction(
      { type: "maps_suggest_places", category: "food", label: "Restaurants" },
      fakeRouter,
      "/map",
    );

    await vi.waitFor(() => expect(mockNearbyPOIs).toHaveBeenCalled());
    expect(mockNearbyPOIs).toHaveBeenCalledWith(14.59, 120.98, expect.any(Number), expect.any(String));
  });

  // ── TTS narration is spoken after POIs load ────────────────────────────
  // This test will FAIL until we add a TTS callback to executeAction.
  // The local VoiceProvider intercept calls buildPOITTS() + mapService.tts()
  // after fetching POIs — the ChatWonder path must do the same.

  it("calls onSuggestPlaces with TTS text after POIs are fetched", async () => {
    const pois = [makePOI("Starbucks"), makePOI("Bo's Coffee")];
    mockNearbyPOIs.mockResolvedValueOnce({ pois });

    const onSuggestPlaces = vi.fn();

    const { executeAction } = await import("./actionExecutor");
    await executeAction(
      { type: "maps_suggest_places", category: "coffee", label: "Coffee shops" },
      fakeRouter,
      "/map",
      undefined,
      { onSuggestPlaces },
    );

    await vi.waitFor(() => expect(onSuggestPlaces).toHaveBeenCalled());

    const [ttsText] = onSuggestPlaces.mock.calls[0];
    expect(typeof ttsText).toBe("string");
    expect(ttsText.length).toBeGreaterThan(0);
  });
});
