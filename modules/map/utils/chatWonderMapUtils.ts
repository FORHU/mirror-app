import type { NearbyPOI } from "../services/map.service";
import type { ChatWonderMapsPlace } from "@/modules/shared/api/chat-wonder.service";

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PLACE_TYPE_MAP: Record<string, { category: string; icon: string }> = {
  cafe: { category: "cafe", icon: "☕" },
  restaurant: { category: "restaurant", icon: "🍽️" },
  bar: { category: "bar", icon: "🍺" },
  store: { category: "store", icon: "🛍️" },
  shopping_mall: { category: "shopping", icon: "🏬" },
  hospital: { category: "medical", icon: "🏥" },
  pharmacy: { category: "pharmacy", icon: "💊" },
  gym: { category: "gym", icon: "💪" },
  park: { category: "park", icon: "🌿" },
  lodging: { category: "hotel", icon: "🏨" },
  gas_station: { category: "gas", icon: "⛽" },
};

export function mapPlaceToNearbyPOI(
  place: ChatWonderMapsPlace,
  originLat: number,
  originLng: number,
): NearbyPOI {
  const typeEntry =
    place.types.map((t) => PLACE_TYPE_MAP[t]).find(Boolean) ?? {
      category: place.types[0] ?? "place",
      icon: "📍",
    };

  return {
    placeId: place.place_id,
    name: place.name,
    category: typeEntry.category,
    categoryIcon: typeEntry.icon,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    distance: haversineKm(originLat, originLng, place.lat, place.lng),
    photo: place.photo_url,
    rating: place.rating ?? undefined,
    userRatingsTotal: place.user_ratings_total ?? 0,
    priceLevel: place.price_level ?? undefined,
    openNow: place.open_now,
    phone: place.phone_number ?? undefined,
    website: place.website ?? undefined,
  };
}

export function curatePOIs(pois: NearbyPOI[], max = 5): NearbyPOI[] {
  const MIN_REVIEWS = 10;
  const qualified = pois.filter(
    (p) => (p.rating ?? 0) > 0 && (p.userRatingsTotal ?? 0) >= MIN_REVIEWS,
  );
  const candidates = qualified.length >= 2 ? qualified : pois;
  const maxDist = Math.max(...candidates.map((p) => p.distance ?? 0), 1);
  return candidates
    .map((p) => ({
      poi: p,
      score:
        ((p.rating ?? 0) / 5) * 0.6 +
        (1 - (p.distance ?? 0) / maxDist) * 0.4,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.poi);
}

export function buildPOITTS(pois: NearbyPOI[]): string {
  if (pois.length === 1) return `${pois[0].name} looks like a great choice. Want to head there?`;
  if (pois.length === 2) return `There's ${pois[0].name} or ${pois[1].name}. Which one?`;
  const last = pois[pois.length - 1].name;
  const rest = pois.slice(0, -1).map((p) => p.name).join(", ");
  return `How about ${rest}, or ${last}? Which one sounds good?`;
}

const ORDINALS: Record<string, number> = {
  first: 0, one: 0, "number one": 0, "option one": 0,
  second: 1, two: 1, "number two": 1, "option two": 1,
  third: 2, three: 2, "number three": 2, "option three": 2,
  fourth: 3, four: 3, "number four": 3, "option four": 3,
  fifth: 4, five: 4, "number five": 4, "option five": 4,
};

export function matchPOIFromTranscript(
  transcript: string,
  pois: NearbyPOI[],
): NearbyPOI | null {
  const lower = transcript.toLowerCase();

  // Tier 1 — ordinal
  for (const [phrase, idx] of Object.entries(ORDINALS)) {
    if (lower.includes(phrase) && pois[idx]) return pois[idx];
  }

  // Tier 2 — name fragment (longest match wins)
  let bestMatch: NearbyPOI | null = null;
  let bestLen = 0;
  for (const poi of pois) {
    const name = poi.name.toLowerCase();
    if (lower.includes(name) && name.length > bestLen) {
      bestMatch = poi;
      bestLen = name.length;
    }
  }
  if (bestMatch) return bestMatch;

  // Tier 3 — superlative
  if (/\b(closest|nearest)\b/.test(lower)) {
    return [...pois].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0] ?? null;
  }
  if (/\b(highest.rated|best.rated|top.rated|best)\b/.test(lower)) {
    return [...pois].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
  }
  if (/\b(cheapest|least.expensive)\b/.test(lower)) {
    return [...pois].sort(
      (a, b) => (a.priceLevel ?? 999) - (b.priceLevel ?? 999),
    )[0] ?? null;
  }

  return null;
}

const NAVIGATION_PATTERN =
  /\b(take me to|navigate to|go to|directions to|how do i get to|get me to|drive to|walk to|bring me to|i want to go to|i need to go to|let's go to|route me|can you route|show me (the way|how to get)|bring me|head to|i('m| am) going to|going to)\b/i;

/** Returns true when the transcript is a direct navigation request — route immediately, no curation. */
export function isNavigationPhrase(transcript: string): boolean {
  return NAVIGATION_PATTERN.test(transcript);
}

const FINISH_PHRASE_PATTERN =
  /\b(that'?s all|done|no more|no more stops|go|let'?s go|start|start navigation|that'?s it|finished|ok go|okay go|set|we'?re good|that will do)\b/i;

export function isFinishPhrase(transcript: string): boolean {
  return FINISH_PHRASE_PATTERN.test(transcript);
}

/**
 * Tries to extract a location name from a natural-language transcript.
 * "meeting at Burnham Park this morning" → "Burnham Park"
 * "lunch at Session Road" → "Session Road"
 * "going to SM City Baguio" → "SM City Baguio"
 */
export function extractLocationFromTranscript(transcript: string): string | null {
  // "at [Location]" followed by time/punctuation/end
  const atMatch = transcript.match(
    /\bat\s+([A-Za-z0-9\s.,'"\-]+?)(?=\s+(?:this\s+(?:morning|afternoon|evening|night|noon)|tonight|for\s+(?:lunch|dinner|breakfast)|in\s+the\s+(?:morning|afternoon|evening)|please|can you|that|,|\.)|$)/i,
  );
  if (atMatch) return atMatch[1].trim();

  // "to [Location]" navigation phrasing
  const toMatch = transcript.match(
    /\bto\s+([A-Za-z0-9\s.,'"\-]+?)(?=\s+(?:please|now|this|for|can|that|,|\.)|$)/i,
  );
  if (toMatch) return toMatch[1].trim();

  // "in [Location]" planning phrasing:
  // "I have a date in La Union" -> "La Union"
  const inMatch = transcript.match(
    /\bin\s+(?!the\s)([A-Za-z0-9\s.,'"\-]+?)(?=\s+(?:today|tonight|tomorrow|this\s+(?:morning|afternoon|evening|weekend)|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend)|at\s+\d|for\s+(?:lunch|dinner|breakfast)|please|can you|that|,|\.)|$)/i,
  );
  if (inMatch) return inMatch[1].trim();

  return null;
}

const ITINERARY_PATTERN =
  /\b(i have|i've got|i need to go|going to|i'll be at|my|there's a)\b.{0,30}\b(meeting|lunch|dinner|breakfast|appointment|event|date|session|class|gym|party|wedding|conference)\b/i;

const TIME_PATTERN =
  /\b(this morning|this afternoon|this evening|tonight|tomorrow|at \d|for lunch|for dinner|in the morning|in the afternoon|in the evening|morning meeting|afternoon|evening)\b/i;

/** Returns true when the transcript looks like an itinerary stop, not a place search. */
export function isItineraryPhrase(transcript: string): boolean {
  return ITINERARY_PATTERN.test(transcript) || TIME_PATTERN.test(transcript);
}

/** Embeds map context into a chat-wonder input string. */
export function buildMapInput(
  transcript: string,
  loc: { lat: number; lng: number } | null | undefined,
  dest: { name?: string; address?: string; lat: number; lng: number } | null | undefined,
  routeActive: boolean,
  pendingEvents?: Array<{ eventName: string; timeLabel: string }>,
): string {
  const parts: string[] = [];
  if (loc) parts.push(`location: ${loc.lat},${loc.lng}`);
  if (dest)
    parts.push(
      `destination: ${dest.name ?? dest.address ?? "unknown"} (${dest.lat},${dest.lng})`,
    );
  if (routeActive) parts.push("route active");
  if (pendingEvents?.length) {
    const list = pendingEvents
      .map((e) => `${e.eventName}/${e.timeLabel || "unspecified time"}`)
      .join(", ");
    parts.push(`pending events: ${list}`);
  }

  const ctx = parts.length ? ` [${parts.join("; ")}]` : "";

  return `[map]${ctx} ${transcript}`;
}
