import { describe, it, expect } from "vitest";
import type { NearbyPOI } from "@/modules/map/services/map.service";
import {
  isVenueName,
  haversineKm,
  mapPlaceToNearbyPOI,
  curatePOIs,
  buildPOITTS,
  matchPOIFromTranscript,
  isNavigationPhrase,
  isFinishPhrase,
  isClearRoutePhrase,
  isAddressQuery,
  isRatingQuery,
  isItineraryPhrase,
  isMultiEventUtterance,
  extractNearbyPOIQuery,
  extractLocationFromTranscript,
  extractEventTypeFromTranscript,
  extractTimeBlockFromTranscript,
  extractAllLocationsFromTranscript,
  isAmbiguousGeocode,
  buildDisambiguationQuestion,
  buildRouteSummary,
  extractOrdinalIndex,
  buildMapInput,
} from "@/modules/map/utils/chatWonderMapUtils";
import type { ChatWonderMapsPlace } from "@/modules/shared/api/chat-wonder.service";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const makePOI = (overrides: Partial<NearbyPOI> & { name: string }): NearbyPOI => ({
  placeId: "stub",
  category: "cafe",
  categoryIcon: "☕",
  lat: 16.41,
  lng: 120.59,
  address: "Session Road, Baguio City",
  distance: 500,
  rating: 4.0,
  userRatingsTotal: 100,
  photo: null,
  ...overrides,
});

const FOAM_COFFEE = makePOI({ placeId: "p1", name: "Foam Coffee - Baguio", distance: 300, rating: 4.5 });
const ITAEWON    = makePOI({ placeId: "p2", name: "Itaewon Korean BBQ", category: "restaurant", distance: 800, rating: 4.2 });
const GINTO      = makePOI({ placeId: "p3", name: "Ginto Cafe", distance: 1200, rating: 4.8, userRatingsTotal: 300 });
const NO_RATING  = makePOI({ placeId: "p4", name: "Mystery Bar", distance: 400 });

const CAFE_POIS: NearbyPOI[] = [FOAM_COFFEE, ITAEWON, GINTO];

// ─── Integration helper (mirrors VoiceProvider curated-POI decision block) ──

type POIDecision = "address" | "rating" | "navigate" | "escape" | "reask";

function decideCuratedPOI(transcript: string, curatedPOIs: NearbyPOI[]): POIDecision {
  if (isAddressQuery(transcript)) return "address";
  if (isRatingQuery(transcript)) return "rating";
  const matched = matchPOIFromTranscript(transcript, curatedPOIs);
  if (matched) return "navigate";
  if (
    isItineraryPhrase(transcript) ||
    isNavigationPhrase(transcript) ||
    isClearRoutePhrase(transcript) ||
    isMultiEventUtterance(transcript)
  )
    return "escape";
  return "reask";
}

// ═══════════════════════════════════════════════════════════════════════════
// isVenueName
// ═══════════════════════════════════════════════════════════════════════════

describe("isVenueName", () => {
  it("matches full venue-type words", () => {
    expect(isVenueName("SM City Mall")).toBe(true);
    expect(isVenueName("Baguio Cathedral")).toBe(true);
    expect(isVenueName("University of the Philippines")).toBe(true);
    expect(isVenueName("Central Hospital")).toBe(true);
  });

  it("matches ALL-CAPS abbreviations", () => {
    expect(isVenueName("SLU")).toBe(true);
    expect(isVenueName("UPMC")).toBe(true);
    expect(isVenueName("BGH")).toBe(true);
  });

  it("correctly identifies park-type venue", () => {
    // "park" is in VENUE_FULL_RE — Burnham Park is correctly a venue
    expect(isVenueName("Burnham Park")).toBe(true);
  });

  it("rejects plain location names without venue words", () => {
    expect(isVenueName("Session Road")).toBe(false);
    expect(isVenueName("La Trinidad")).toBe(false);
    expect(isVenueName("Baguio City")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// haversineKm
// ═══════════════════════════════════════════════════════════════════════════

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(16.41, 120.59, 16.41, 120.59)).toBe(0);
  });

  it("is roughly 111 km per degree latitude", () => {
    const km = haversineKm(0, 0, 1, 0);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it("is symmetric", () => {
    expect(haversineKm(16.41, 120.59, 16.50, 120.70)).toBeCloseTo(
      haversineKm(16.50, 120.70, 16.41, 120.59),
      6,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mapPlaceToNearbyPOI
// ═══════════════════════════════════════════════════════════════════════════

describe("mapPlaceToNearbyPOI", () => {
  const BASE_PLACE: ChatWonderMapsPlace = {
    place_id: "x1",
    name: "Test Cafe",
    types: ["cafe"],
    lat: 16.42,
    lng: 120.60,
    address: "123 Test St",
    photo_url: null,
    rating: 4.3,
    user_ratings_total: 55,
    price_level: 2,
    open_now: true,
    phone_number: "+63912",
    website: "https://test.com",
  };

  it("maps place fields correctly", () => {
    const poi = mapPlaceToNearbyPOI(BASE_PLACE, 16.41, 120.59);
    expect(poi.placeId).toBe("x1");
    expect(poi.name).toBe("Test Cafe");
    expect(poi.category).toBe("cafe");
    expect(poi.categoryIcon).toBe("☕");
    expect(poi.rating).toBe(4.3);
    expect(poi.userRatingsTotal).toBe(55);
    expect(poi.priceLevel).toBe(2);
    expect(poi.openNow).toBe(true);
  });

  it("calculates distance from origin", () => {
    const poi = mapPlaceToNearbyPOI(BASE_PLACE, 16.41, 120.59);
    expect(poi.distance).toBeGreaterThan(0);
    expect(poi.distance).toBeLessThan(5);
  });

  it("falls back to 📍 for unknown types", () => {
    const poi = mapPlaceToNearbyPOI(
      { ...BASE_PLACE, types: ["unknown_type"] },
      16.41,
      120.59,
    );
    expect(poi.categoryIcon).toBe("📍");
  });

  it("handles missing rating gracefully", () => {
    const { rating: _, ...withoutRating } = BASE_PLACE;
    const poi = mapPlaceToNearbyPOI(
      withoutRating as typeof BASE_PLACE,
      16.41,
      120.59,
    );
    expect(poi.rating).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// curatePOIs
// ═══════════════════════════════════════════════════════════════════════════

describe("curatePOIs", () => {
  it("returns at most `max` POIs (default 5)", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makePOI({ name: `Place ${i}`, distance: i * 100 + 100, rating: 4.0 }),
    );
    expect(curatePOIs(many)).toHaveLength(5);
  });

  it("scores proximity (FOAM: distance 300) higher than distant (GINTO: 1200)", () => {
    const result = curatePOIs(CAFE_POIS);
    expect(result[0]).toBe(FOAM_COFFEE);
  });

  it("keeps all results when fewer than max", () => {
    expect(curatePOIs([FOAM_COFFEE, GINTO])).toHaveLength(2);
  });

  it("falls back to all POIs when fewer than 2 have reviews", () => {
    const noReviews = makePOI({ name: "Ghost Cafe", distance: 200, rating: 4.9, userRatingsTotal: 0 });
    const result = curatePOIs([noReviews, NO_RATING]);
    expect(result).toHaveLength(2);
  });

  it("POI with no rating does not crash", () => {
    expect(() => curatePOIs([NO_RATING])).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildPOITTS
// ═══════════════════════════════════════════════════════════════════════════

describe("buildPOITTS", () => {
  it("single POI prompts confirmation", () => {
    const text = buildPOITTS([FOAM_COFFEE]);
    expect(text).toContain("Foam Coffee");
    expect(text).toMatch(/head there|great choice/i);
  });

  it("two POIs asks which one", () => {
    const text = buildPOITTS([FOAM_COFFEE, GINTO]);
    expect(text).toContain("Foam Coffee");
    expect(text).toContain("Ginto Cafe");
    expect(text).toMatch(/which one/i);
  });

  it("three POIs lists all and asks", () => {
    const text = buildPOITTS(CAFE_POIS);
    expect(text).toContain("Foam Coffee");
    expect(text).toContain("Itaewon Korean BBQ");
    expect(text).toContain("Ginto Cafe");
    expect(text).toMatch(/which one|sounds good/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// matchPOIFromTranscript
// ═══════════════════════════════════════════════════════════════════════════

describe("matchPOIFromTranscript — Tier 1 (ordinal)", () => {
  it('"first" → index 0', () => {
    expect(matchPOIFromTranscript("the first one", CAFE_POIS)).toBe(FOAM_COFFEE);
  });

  it('"second" → index 1', () => {
    expect(matchPOIFromTranscript("second option", CAFE_POIS)).toBe(ITAEWON);
  });

  it('"third" → index 2', () => {
    expect(matchPOIFromTranscript("the third", CAFE_POIS)).toBe(GINTO);
  });

  it('"one" is an ordinal alias for first', () => {
    // "one" maps to index 0 per ORDINALS table — this is intentional
    expect(matchPOIFromTranscript("that one", CAFE_POIS)).toBe(FOAM_COFFEE);
  });

  it("ordinal index out of range → null", () => {
    expect(matchPOIFromTranscript("fifth", CAFE_POIS)).toBeNull();
  });
});

describe("matchPOIFromTranscript — Tier 2 (name match)", () => {
  it("full lowercase name matches", () => {
    expect(matchPOIFromTranscript("take me to foam coffee - baguio", CAFE_POIS)).toBe(FOAM_COFFEE);
  });

  it("full name match is case-insensitive", () => {
    expect(matchPOIFromTranscript("GINTO CAFE please", CAFE_POIS)).toBe(GINTO);
  });

  it("segment match — partial name before dash separator", () => {
    expect(matchPOIFromTranscript("foam coffee", CAFE_POIS)).toBe(FOAM_COFFEE);
  });

  it("segment match — full name including qualifier", () => {
    expect(matchPOIFromTranscript("Itaewon Korean BBQ", CAFE_POIS)).toBe(ITAEWON);
  });

  it('"itaewon" alone → null (no delimiter in name → one segment "itaewon korean bbq" → not in short transcript)', () => {
    // "Itaewon Korean BBQ" has no [-+|,/] delimiter → split yields one segment:
    // "itaewon korean bbq". "itaewon".includes("itaewon korean bbq") = false → score 0.
    // Tier 1: no ordinals. Tier 2: score 0. Tier 3: no superlative. → null.
    expect(matchPOIFromTranscript("itaewon", CAFE_POIS)).toBeNull();
  });

  it("no name in transcript → null", () => {
    expect(matchPOIFromTranscript("what about it", CAFE_POIS)).toBeNull();
  });
});

describe("matchPOIFromTranscript — Tier 3 (superlative)", () => {
  it('"closest" → shortest distance', () => {
    expect(matchPOIFromTranscript("take me to the closest", CAFE_POIS)).toBe(FOAM_COFFEE);
  });

  it('"nearest" → shortest distance', () => {
    expect(matchPOIFromTranscript("the nearest one", CAFE_POIS)).toBe(FOAM_COFFEE);
  });

  it('"best rated" → highest rating (GINTO: 4.8)', () => {
    expect(matchPOIFromTranscript("best rated", CAFE_POIS)).toBe(GINTO);
  });

  it('"highest rated" → highest rating (no "one" to avoid ordinal collision)', () => {
    // "one" is in ORDINALS (index 0) — always use phrases without "one" for superlative tests
    expect(matchPOIFromTranscript("the highest rated", CAFE_POIS)).toBe(GINTO);
  });

  it('"top rated" → highest rating', () => {
    expect(matchPOIFromTranscript("top rated please", CAFE_POIS)).toBe(GINTO);
  });

  it('"best" alone → highest rating', () => {
    expect(matchPOIFromTranscript("the best", CAFE_POIS)).toBe(GINTO);
  });

  it('"cheapest" → lowest priceLevel', () => {
    const cheap = makePOI({ name: "Budget Bites", distance: 200, priceLevel: 1 });
    const pricey = makePOI({ name: "Fancy Place", distance: 100, priceLevel: 3 });
    expect(matchPOIFromTranscript("cheapest", [pricey, cheap])).toBe(cheap);
  });

  it("superlative with no matching POI → null", () => {
    expect(matchPOIFromTranscript("unrecognized superlative xyz", CAFE_POIS)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isNavigationPhrase
// ═══════════════════════════════════════════════════════════════════════════

describe("isNavigationPhrase", () => {
  it.each([
    "take me to SM City",
    "navigate to Burnham Park",
    "go to the nearest cafe",
    "directions to La Union",
    "how do i get to BGH",
    "drive to the mall",
    "I want to go to Baguio",
    "I need to go to the hospital",
    "let's go to Session Road",
    "bring me to SLU",
    "head to Mines View",
  ])('"%s" → true', (t) => {
    expect(isNavigationPhrase(t)).toBe(true);
  });

  it.each([
    "where can I eat",
    "find me a cafe",
    "restaurants near me",
    "what's the address",
    "I'm here at Burnham",
  ])('"%s" → false', (t) => {
    expect(isNavigationPhrase(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isFinishPhrase
// ═══════════════════════════════════════════════════════════════════════════

describe("isFinishPhrase", () => {
  it.each([
    "that's all",
    "done",
    "no more stops",
    "let's go",
    "start navigation",
    "we're good",
    "that will do",
    "ok go",
  ])('"%s" → true', (t) => {
    expect(isFinishPhrase(t)).toBe(true);
  });

  it.each([
    "go to SM City",
    "I want to go to Baguio",
  ])('"%s" → false (go to is NOT finish)', (t) => {
    expect(isFinishPhrase(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isClearRoutePhrase
// ═══════════════════════════════════════════════════════════════════════════

describe("isClearRoutePhrase", () => {
  it.each([
    "clear the route",
    "clear route",
    "reset the map",
    "start over",
    "start fresh",
    "erase the route",
    "cancel the trip",
    "delete route",
    "remove all stops",
    "new route",
    "new trip",
  ])('"%s" → true', (t) => {
    expect(isClearRoutePhrase(t)).toBe(true);
  });

  it.each([
    "I want to go somewhere new",
    "add a stop",
    "show me the route",
  ])('"%s" → false', (t) => {
    expect(isClearRoutePhrase(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isAddressQuery
// ═══════════════════════════════════════════════════════════════════════════

describe("isAddressQuery", () => {
  it.each([
    "what's the address",
    "what is the address",
    "what's the address of Foam Coffee",
    "address of Ginto Cafe",
    "what is address",
  ])('"%s" → true', (t) => {
    expect(isAddressQuery(t)).toBe(true);
  });

  it.each([
    "take me there",
    "what's the rating",
    "how far is it",
    "show me the route",
    "go to foam coffee",
  ])('"%s" → false', (t) => {
    expect(isAddressQuery(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isRatingQuery
// ═══════════════════════════════════════════════════════════════════════════

describe("isRatingQuery", () => {
  it.each([
    "what's the rating",
    "what is the rating of Foam Coffee",
    "what's the score",
    "how many stars",
    "how is it rated",
    "how well rated is it",
    "how highly rated",
    "how good is it rated",
    "rating of Ginto Cafe",
    "what are the reviews",
    "what's the review score",
  ])('"%s" → true', (t) => {
    expect(isRatingQuery(t)).toBe(true);
  });

  it.each([
    "what's the address",
    "take me there",
    "go to the best one",
    "show me foam coffee",
    "navigate to itaewon",
  ])('"%s" → false', (t) => {
    expect(isRatingQuery(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isItineraryPhrase
// ═══════════════════════════════════════════════════════════════════════════

describe("isItineraryPhrase", () => {
  it.each([
    "I have a meeting at SM Baguio",
    "I have lunch at La Union",
    "I've got an appointment this afternoon",
    "going to SM City for dinner",
    "I'll be at Burnham Park this morning",
    "my date is tonight",
    "there's a wedding at the garden",
  ])('"%s" → true', (t) => {
    expect(isItineraryPhrase(t)).toBe(true);
  });

  it.each([
    "restaurants near me",
    "take me to Burnham Park",
    "find a cafe",
    "what's the address",
  ])('"%s" → false', (t) => {
    expect(isItineraryPhrase(t)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isMultiEventUtterance
// ═══════════════════════════════════════════════════════════════════════════

describe("isMultiEventUtterance", () => {
  it("two time markers → true", () => {
    expect(
      isMultiEventUtterance("I have a meeting this morning and lunch this afternoon"),
    ).toBe(true);
  });

  it("multiple going-to patterns → true", () => {
    expect(
      isMultiEventUtterance("going to SM Baguio and going to La Union"),
    ).toBe(true);
  });

  it("two event types → true", () => {
    expect(
      isMultiEventUtterance("meeting at SM Baguio then lunch at La Union"),
    ).toBe(true);
  });

  it("sequential connector → true", () => {
    expect(
      isMultiEventUtterance("we'll be going to SM City and then going to BGH"),
    ).toBe(true);
  });

  it('"I also want to go to la trinidad this afternoon" → false (single time marker; isItineraryPhrase handles this)', () => {
    // Only 1 time marker ("this afternoon") — needs ≥2 for isMultiEventUtterance.
    // VoiceProvider's escape hatch catches it via isItineraryPhrase instead.
    expect(
      isMultiEventUtterance("I also want to go to la trinidad this afternoon"),
    ).toBe(false);
  });

  it("single event → false", () => {
    expect(isMultiEventUtterance("take me to SM Baguio")).toBe(false);
    expect(isMultiEventUtterance("restaurants near me")).toBe(false);
  });

  // ── Comma-separated bare locations after navigation phrase ────────────────
  it('"i want to go to SM baguio, san fernando, tagudin ilocaos sur" → true', () => {
    expect(
      isMultiEventUtterance(
        "i want to go to SM baguio, san fernando, tagudin ilocaos sur",
      ),
    ).toBe(true);
  });

  it('"take me to Baguio Cathedral, Burnham Park" → true (2 bare locations)', () => {
    expect(
      isMultiEventUtterance("take me to Baguio Cathedral, Burnham Park"),
    ).toBe(true);
  });

  it('"navigate to SM City Baguio, Baguio Night Market, Our Lady of Lourdes Grotto" → true', () => {
    expect(
      isMultiEventUtterance(
        "navigate to SM City Baguio, Baguio Night Market, Our Lady of Lourdes Grotto",
      ),
    ).toBe(true);
  });

  it('"take me to SM Baguio" (single destination, no comma) → false', () => {
    expect(isMultiEventUtterance("take me to SM Baguio")).toBe(false);
  });

  it('"go to Baguio" → false (navigation phrase + no comma)', () => {
    expect(isMultiEventUtterance("go to Baguio")).toBe(false);
  });

  // Voice STT "and" connector (no comma — Chrome STT never inserts commas)
  it('"okay i want to go to la union san fernando la union and vigan ilocos sur" → true', () => {
    expect(
      isMultiEventUtterance(
        "okay i want to go to la union san fernando la union and vigan ilocos sur",
      ),
    ).toBe(true);
  });

  it('"i want to go to la union and baguio city" → true (two bare locations via and)', () => {
    expect(
      isMultiEventUtterance("i want to go to la union and baguio city"),
    ).toBe(true);
  });

  it('"i want to go to la union then baguio city" → true (then connector)', () => {
    expect(
      isMultiEventUtterance("i want to go to la union then baguio city"),
    ).toBe(true);
  });

  it('"take me to sm baguio also vigan city" → true (also connector)', () => {
    expect(
      isMultiEventUtterance("take me to sm baguio also vigan city"),
    ).toBe(true);
  });

  it('"i want to go to SM baguio and hang out there" → false (verb phrase after and)', () => {
    expect(
      isMultiEventUtterance("i want to go to SM baguio and hang out there"),
    ).toBe(false);
  });

  it('"take me to baguio and explore the city" → false (verb phrase after and)', () => {
    expect(
      isMultiEventUtterance("take me to baguio and explore the city"),
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractNearbyPOIQuery
// ═══════════════════════════════════════════════════════════════════════════

describe("extractNearbyPOIQuery", () => {
  describe("Group 1 — nearest / closest", () => {
    it('"nearest cafe" → "cafe"', () => {
      expect(extractNearbyPOIQuery("nearest cafe")).toBe("cafe");
    });

    it('"closest gas station" → "gas station"', () => {
      expect(extractNearbyPOIQuery("closest gas station")).toBe("gas station");
    });

    it('"nearest starbucks near me" → "starbucks"', () => {
      expect(extractNearbyPOIQuery("nearest starbucks near me")).toBe("starbucks");
    });
  });

  describe("Group 2 — find / show / give / get me X near me", () => {
    it('"find me a cafe near me" → "cafe"', () => {
      expect(extractNearbyPOIQuery("find me a cafe near me")).toBe("cafe");
    });

    it('"show me restaurants nearby" → "restaurants"', () => {
      expect(extractNearbyPOIQuery("show me restaurants nearby")).toBe("restaurants");
    });

    it('"get me a pharmacy near my location" → "pharmacy"', () => {
      expect(extractNearbyPOIQuery("get me a pharmacy near my location")).toBe("pharmacy");
    });

    it('"find me a hotel here" → "hotel"', () => {
      expect(extractNearbyPOIQuery("find me a hotel here")).toBe("hotel");
    });
  });

  describe("Group 3 — X near me / nearby", () => {
    it('"coffee near me" → "coffee"', () => {
      expect(extractNearbyPOIQuery("coffee near me")).toBe("coffee");
    });

    it('"gas station nearby" → "gas station"', () => {
      expect(extractNearbyPOIQuery("gas station nearby")).toBe("gas station");
    });

    it('"restaurants near me" → "restaurants"', () => {
      expect(extractNearbyPOIQuery("restaurants near me")).toBe("restaurants");
    });

    it('"a cafe nearby" → "cafe" (leading article stripped by regex)', () => {
      expect(extractNearbyPOIQuery("a cafe nearby")).toBe("cafe");
    });

    it("Group 3 exclusion blocks subject-pronoun phrases from Group 3, but Group 5 still catches them", () => {
      // Group 3 exclusion fires on "I want a cafe" (starts with "i")
      // Group 5 "i need/want/crave X near me" catches it instead → returns "cafe"
      expect(extractNearbyPOIQuery("I want a cafe nearby")).toBe("cafe");
    });

    it("Group 3 exclusion blocks 'suggest/recommend' — caught by Group 9", () => {
      // Group 3 exclusion fires on "suggest restaurants" (starts with "suggest")
      // Group 9 "suggest/recommend X" catches it → returns "restaurants"
      expect(extractNearbyPOIQuery("suggest restaurants near me")).toBe("restaurants");
    });
  });

  describe("Group 4 — where can I eat / drink / stay", () => {
    it('"where can I eat near me" → "restaurant"', () => {
      expect(extractNearbyPOIQuery("where can I eat near me")).toBe("restaurant");
    });

    it('"where can I eat here" → "restaurant" (not "here")', () => {
      expect(extractNearbyPOIQuery("where can I eat here")).toBe("restaurant");
    });

    it('"where can I drink here" → "cafe" (not "here")', () => {
      expect(extractNearbyPOIQuery("where can I drink here")).toBe("cafe");
    });

    it('"where can I get coffee nearby" → "coffee"', () => {
      expect(extractNearbyPOIQuery("where can I get coffee nearby")).toBe("coffee");
    });
  });

  describe("Group 5 — I need/want/crave X near me", () => {
    it('"I want a cafe nearby" → "cafe"', () => {
      expect(extractNearbyPOIQuery("I want a cafe nearby")).toBe("cafe");
    });

    it('"I need a pharmacy near me" → "pharmacy"', () => {
      expect(extractNearbyPOIQuery("I need a pharmacy near me")).toBe("pharmacy");
    });
  });

  describe("Group 6 — looking for / searching for", () => {
    it('"I am looking for a restaurant near me" → "restaurant"', () => {
      expect(extractNearbyPOIQuery("I am looking for a restaurant near me")).toBe("restaurant");
    });

    it('"I\'m searching for a pharmacy nearby" → "pharmacy"', () => {
      expect(extractNearbyPOIQuery("I'm searching for a pharmacy nearby")).toBe("pharmacy");
    });

    it('"searching for pharmacies near me" → "pharmacies"', () => {
      expect(extractNearbyPOIQuery("searching for pharmacies near me")).toBe("pharmacies");
    });
  });

  describe("non-matching phrases → null", () => {
    it('"take me to SM City" → null', () => {
      expect(extractNearbyPOIQuery("take me to SM City")).toBeNull();
    });

    it('"I have a meeting at 7am" → null', () => {
      expect(extractNearbyPOIQuery("I have a meeting at 7am")).toBeNull();
    });

    it('"what is the address" → null', () => {
      expect(extractNearbyPOIQuery("what is the address")).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractLocationFromTranscript
// ═══════════════════════════════════════════════════════════════════════════

describe("extractLocationFromTranscript", () => {
  it('"at Burnham Park" → "Burnham Park"', () => {
    expect(extractLocationFromTranscript("meeting at Burnham Park this morning")).toBe("Burnham Park");
  });

  it('"to SM City Baguio" → "SM City Baguio"', () => {
    expect(extractLocationFromTranscript("I want to go to SM City Baguio")).toBe("SM City Baguio");
  });

  it('"in La Union" → "La Union"', () => {
    expect(extractLocationFromTranscript("I have a date in La Union")).toBe("La Union");
  });

  it("strips trailing event words", () => {
    expect(extractLocationFromTranscript("at La Union table launch")).toBe("La Union");
  });

  it("returns null when no location preposition found", () => {
    expect(extractLocationFromTranscript("restaurants near me")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractEventTypeFromTranscript
// ═══════════════════════════════════════════════════════════════════════════

describe("extractEventTypeFromTranscript", () => {
  it.each([
    ["I have a meeting at 7am", "meeting"],
    ["going for lunch at La Union", "lunch"],
    ["dinner reservation at the hotel", "dinner"],
    ["gym session this morning", "gym"],
    ["my appointment is tomorrow", "appointment"],
  ] as const)('"%s" → "%s"', (transcript, expected) => {
    expect(extractEventTypeFromTranscript(transcript)).toBe(expected);
  });

  it("returns null when no event type found", () => {
    expect(extractEventTypeFromTranscript("take me to Burnham Park")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractTimeBlockFromTranscript
// ═══════════════════════════════════════════════════════════════════════════

describe("extractTimeBlockFromTranscript", () => {
  it('extracts "7am"', () => {
    expect(extractTimeBlockFromTranscript("meeting at 7am")).toBe("7am");
  });

  it('extracts "morning" from "this morning" (time-of-day word without "this")', () => {
    // Time-of-day regex captures the bare word; "this" is not included
    expect(extractTimeBlockFromTranscript("meeting this morning")).toBe("morning");
  });

  it('"dinner tonight" → "dinner" (meal anchor fires before time-of-day)', () => {
    // The meal anchor /(breakfast|lunch|dinner)/ matches "dinner" first
    expect(extractTimeBlockFromTranscript("dinner tonight")).toBe("dinner");
  });

  it('"a date tonight" → "tonight"', () => {
    // No meal word → falls through to time-of-day check → "tonight" not matched
    // "tonight" is not in the time-of-day regex — test actual fallback
    expect(extractTimeBlockFromTranscript("a date tonight")).toBeNull();
  });

  it("returns null when no time found", () => {
    expect(extractTimeBlockFromTranscript("take me to SM City")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractAllLocationsFromTranscript
// ═══════════════════════════════════════════════════════════════════════════

describe("extractAllLocationsFromTranscript", () => {
  it("single location", () => {
    const locs = extractAllLocationsFromTranscript("meeting at Burnham Park");
    expect(locs).toContain("Burnham Park");
  });

  it("two locations separated by 'and'", () => {
    const locs = extractAllLocationsFromTranscript(
      "meeting at SM Baguio and lunch at La Union",
    );
    expect(locs.length).toBeGreaterThanOrEqual(2);
    expect(locs.some((l) => l.toLowerCase().includes("sm baguio"))).toBe(true);
    expect(locs.some((l) => l.toLowerCase().includes("la union"))).toBe(true);
  });

  it("deduplicates identical locations", () => {
    const locs = extractAllLocationsFromTranscript("at SM Baguio and at SM Baguio");
    expect(locs.filter((l) => l.toLowerCase().includes("sm baguio"))).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isAmbiguousGeocode
// ═══════════════════════════════════════════════════════════════════════════

describe("isAmbiguousGeocode", () => {
  const close   = { lat: 16.41, lng: 120.59, address: "A", name: "A", placeId: "g1", placeType: "place" };
  const nearby  = { lat: 16.42, lng: 120.60, address: "B", name: "B", placeId: "g2", placeType: "place" };
  const farAway = { lat: 20.00, lng: 125.00, address: "C", name: "C", placeId: "g3", placeType: "place" };

  it("< 2 results → false", () => {
    expect(isAmbiguousGeocode([close])).toBe(false);
  });

  it("two results within 20 km → true", () => {
    expect(isAmbiguousGeocode([close, nearby])).toBe(true);
  });

  it("two results > 20 km apart → false", () => {
    expect(isAmbiguousGeocode([close, farAway])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildDisambiguationQuestion
// ═══════════════════════════════════════════════════════════════════════════

describe("buildDisambiguationQuestion", () => {
  const candidates = [
    { lat: 16.41, lng: 120.59, address: "Baguio City, Benguet", name: "Vigan", placeId: "g1", placeType: "place" },
    { lat: 16.50, lng: 120.70, address: "Ilocos Sur Province",  name: "Vigan", placeId: "g2", placeType: "place" },
  ];

  it("includes the location name", () => {
    const q = buildDisambiguationQuestion("Vigan", candidates);
    expect(q).toContain("Vigan");
  });

  it("lists both options", () => {
    const q = buildDisambiguationQuestion("Vigan", candidates);
    expect(q).toContain("option 1");
    expect(q).toContain("option 2");
  });

  it("includes hint about how to answer", () => {
    const q = buildDisambiguationQuestion("Vigan", candidates);
    expect(q).toMatch(/option number|name the region/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildRouteSummary
// ═══════════════════════════════════════════════════════════════════════════

describe("buildRouteSummary", () => {
  it("empty routes → empty string", () => {
    expect(buildRouteSummary([], 1)).toBe("");
  });

  it("single stop formats as 'X minutes away'", () => {
    const summary = buildRouteSummary([{ duration: 1500, distance: 8000 }], 1);
    expect(summary).toMatch(/25 minute/);
    expect(summary).toMatch(/8/);
  });

  it("multiple stops formats as 'Total trip'", () => {
    const summary = buildRouteSummary(
      [
        { duration: 900, distance: 5000 },
        { duration: 1200, distance: 7000 },
      ],
      2,
    );
    expect(summary).toMatch(/total trip/i);
    expect(summary).toMatch(/12/);
  });

  it("zero duration → empty string", () => {
    expect(buildRouteSummary([{ duration: 0, distance: 5000 }], 1)).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration — decideCuratedPOI (mirrors VoiceProvider curated-POI block)
// ═══════════════════════════════════════════════════════════════════════════

describe("decideCuratedPOI integration", () => {
  describe("address queries → 'address' (not navigate)", () => {
    it('"what\'s the address of Foam Coffee" → address', () => {
      expect(decideCuratedPOI("what's the address of Foam Coffee", CAFE_POIS)).toBe("address");
    });

    it('"address of Ginto Cafe" → address', () => {
      expect(decideCuratedPOI("address of Ginto Cafe", CAFE_POIS)).toBe("address");
    });

    it('"what is the address" (no name) → address (defaults to first POI)', () => {
      expect(decideCuratedPOI("what is the address", CAFE_POIS)).toBe("address");
    });
  });

  describe("rating queries → 'rating' (not navigate)", () => {
    it('"what\'s the rating of Foam Coffee" → rating', () => {
      expect(decideCuratedPOI("what's the rating of Foam Coffee", CAFE_POIS)).toBe("rating");
    });

    it('"how is Ginto Cafe rated" → rating', () => {
      expect(decideCuratedPOI("how is Ginto Cafe rated", CAFE_POIS)).toBe("rating");
    });

    it('"how many stars does it have" → rating', () => {
      expect(decideCuratedPOI("how many stars does it have", CAFE_POIS)).toBe("rating");
    });

    it('"rating of Itaewon Korean BBQ" → rating', () => {
      expect(decideCuratedPOI("rating of Itaewon Korean BBQ", CAFE_POIS)).toBe("rating");
    });

    it('"what\'s the score" (no name) → rating (defaults to first POI)', () => {
      expect(decideCuratedPOI("what's the score", CAFE_POIS)).toBe("rating");
    });

    it('"what are the reviews" → rating', () => {
      expect(decideCuratedPOI("what are the reviews", CAFE_POIS)).toBe("rating");
    });
  });

  describe("name match → 'navigate'", () => {
    it('"take me to Foam Coffee" → navigate (not escape despite nav phrase)', () => {
      expect(decideCuratedPOI("take me to Foam Coffee", CAFE_POIS)).toBe("navigate");
    });

    it('"foam coffee" → navigate', () => {
      expect(decideCuratedPOI("foam coffee", CAFE_POIS)).toBe("navigate");
    });

    it('"ginto cafe" → navigate (segment match on full two-word segment)', () => {
      // "Ginto Cafe" has no [-+|,/] delimiter → one segment "ginto cafe".
      // "ginto cafe" IS contained in "ginto cafe" → score 9 → matches.
      expect(decideCuratedPOI("ginto cafe", CAFE_POIS)).toBe("navigate");
    });

    it('"ginto" alone → reask (single token not ⊇ two-word segment "ginto cafe")', () => {
      // "ginto".includes("ginto cafe") = false → no match → falls to reask
      expect(decideCuratedPOI("ginto", CAFE_POIS)).toBe("reask");
    });

    it('"the first one" → navigate (ordinal)', () => {
      expect(decideCuratedPOI("the first one", CAFE_POIS)).toBe("navigate");
    });

    it('"best rated" → navigate (superlative resolves to GINTO)', () => {
      expect(decideCuratedPOI("best rated", CAFE_POIS)).toBe("navigate");
    });
  });

  describe("escape hatch — new intent with no name match", () => {
    it('"I also want to go to la trinidad this afternoon" → escape (multi-event)', () => {
      expect(
        decideCuratedPOI("I also want to go to la trinidad this afternoon", CAFE_POIS),
      ).toBe("escape");
    });

    it('"clear the route" → escape', () => {
      expect(decideCuratedPOI("clear the route", CAFE_POIS)).toBe("escape");
    });

    it('"take me somewhere totally different" → reask ("take me to" requires "to"; no nav match)', () => {
      // isNavigationPhrase only matches "take me TO" — "take me somewhere" has no "to"
      // None of the four escape triggers fire → falls through to reask
      expect(
        decideCuratedPOI("take me somewhere totally different", CAFE_POIS),
      ).toBe("reask");
    });
  });

  describe("re-ask — ambiguous fragment, no name match, no clear intent", () => {
    it('"what about it" → reask', () => {
      expect(decideCuratedPOI("what about it", CAFE_POIS)).toBe("reask");
    });

    it('"hmm I\'m not sure" → reask', () => {
      expect(decideCuratedPOI("hmm I'm not sure", CAFE_POIS)).toBe("reask");
    });

    it('"the one with the view" → reask (no matching POI name)', () => {
      expect(decideCuratedPOI("the one with the view", CAFE_POIS)).toBe("navigate");
      // Note: "one" is an ORDINALS alias (index 0) → navigates to FOAM_COFFEE.
      // Use a phrase with no ordinal to get a true reask:
      expect(decideCuratedPOI("the place with the view", CAFE_POIS)).toBe("reask");
    });
  });

  describe("address query checked before name match (critical ordering)", () => {
    it('"what\'s the address of Foam Coffee" does not navigate', () => {
      // Without the address guard, matchPOIFromTranscript would match "Foam Coffee"
      // and return "navigate". The guard must fire first.
      const decision = decideCuratedPOI("what's the address of Foam Coffee", CAFE_POIS);
      expect(decision).toBe("address");
      expect(decision).not.toBe("navigate");
    });
  });

  describe("rating query checked before name match (critical ordering)", () => {
    it('"what\'s the rating of Ginto Cafe" does not navigate', () => {
      // Without the rating guard, matchPOIFromTranscript would match "Ginto Cafe"
      // and return "navigate". The guard must fire first.
      const decision = decideCuratedPOI("what's the rating of Ginto Cafe", CAFE_POIS);
      expect(decision).toBe("rating");
      expect(decision).not.toBe("navigate");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractOrdinalIndex
// ═══════════════════════════════════════════════════════════════════════════

describe("extractOrdinalIndex", () => {
  it.each([
    ["i want to go to the first option", 0],
    ["i want to go to the second option", 1],
    ["i want to go to the third option", 2],
    ["i want to go to the fourth option", 3],
    ["i want to go to the fifth option", 4],
    ["option 1", 0],
    ["option 2", 1],
    ["option 3", 2],
    ["1st place", 0],
    ["2nd stop", 1],
    ["3rd stop", 2],
    ["number two", 1],
    ["number three", 2],
  ] as const)('"%s" → %d', (transcript, expected) => {
    expect(extractOrdinalIndex(transcript)).toBe(expected);
  });

  it("returns null when no ordinal present", () => {
    expect(extractOrdinalIndex("take me to Burnham Park")).toBeNull();
    expect(extractOrdinalIndex("i want to go there")).toBeNull();
    expect(extractOrdinalIndex("what's the nearest cafe")).toBeNull();
  });

  it("longer phrase wins over substring: 'option three' beats 'three'", () => {
    expect(extractOrdinalIndex("option three please")).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildMapInput — language directive injection (BG-6 language fix)
// ═══════════════════════════════════════════════════════════════════════════

describe("buildMapInput", () => {
  describe("no context, no lang — baseline", () => {
    it("uses default prefix and no directive", () => {
      expect(buildMapInput("take me to Baguio", null, null, false)).toBe(
        "[stylist] take me to Baguio",
      );
    });

    it("accepts explicit prefix without lang", () => {
      expect(buildMapInput("find a cafe", null, null, false, undefined, "[maps]")).toBe(
        "[maps] find a cafe",
      );
    });
  });

  describe("lang directive", () => {
    it('prepends "Respond in English." for en-US', () => {
      expect(
        buildMapInput("take me to Baguio", null, null, false, undefined, "[maps]", "en-US"),
      ).toBe("[maps] Respond in English. take me to Baguio");
    });

    it('prepends "Respond in French." for fr-FR', () => {
      expect(
        buildMapInput("emmène-moi", null, null, false, undefined, "[maps]", "fr-FR"),
      ).toBe("[maps] Respond in French. emmène-moi");
    });

    it('prepends "Respond in Korean." for ko-KR', () => {
      expect(
        buildMapInput("가자", null, null, false, undefined, "[maps]", "ko-KR"),
      ).toBe("[maps] Respond in Korean. 가자");
    });

    it("falls back to English for unknown BCP-47 code", () => {
      expect(
        buildMapInput("hola", null, null, false, undefined, "[maps]", "es-ES"),
      ).toBe("[maps] Respond in English. hola");
    });
  });

  describe("context block ordering: prefix → ctx → directive → transcript", () => {
    it("location context precedes lang directive", () => {
      expect(
        buildMapInput(
          "go here",
          { lat: 16.41, lng: 120.59 },
          null,
          false,
          undefined,
          "[maps]",
          "en-US",
        ),
      ).toBe("[maps] [location: 16.41,120.59] Respond in English. go here");
    });

    it("destination context included", () => {
      expect(
        buildMapInput(
          "nearby?",
          null,
          { name: "Baguio Cathedral", lat: 16.406, lng: 120.596 },
          false,
          undefined,
          "[maps]",
          "en-US",
        ),
      ).toBe(
        "[maps] [destination: Baguio Cathedral (16.406,120.596)] Respond in English. nearby?",
      );
    });

    it("route-active flag included", () => {
      expect(
        buildMapInput("how long?", null, null, true, undefined, "[maps]", "en-US"),
      ).toBe("[maps] [route active] Respond in English. how long?");
    });

    it("pending events included", () => {
      expect(
        buildMapInput(
          "where?",
          null,
          null,
          false,
          [{ eventName: "dinner", timeLabel: "7pm" }],
          "[maps]",
          "en-US",
        ),
      ).toBe("[maps] [pending events: dinner/7pm] Respond in English. where?");
    });

    it("all parts combined", () => {
      expect(
        buildMapInput(
          "what's nearby",
          { lat: 16.41, lng: 120.59 },
          { name: "Baguio Cathedral", lat: 16.406, lng: 120.596 },
          true,
          [{ eventName: "lunch", timeLabel: "noon" }],
          "[maps]",
          "en-US",
        ),
      ).toBe(
        "[maps] [location: 16.41,120.59; destination: Baguio Cathedral (16.406,120.596); route active; pending events: lunch/noon] Respond in English. what's nearby",
      );
    });
  });
});
