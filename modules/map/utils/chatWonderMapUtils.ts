import type { NearbyPOI, GeocodeResult } from "../services/map.service";
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
  /\b(that'?s all|done|no more|no more stops|let'?s go|start|start navigation|that'?s it|finished|ok go|okay go|set|we'?re good|that will do)\b|\bgo(?!\s+to\b)/i;

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

  // "to [Location]" navigation phrasing — but only when the extracted text is an
  // actual place name, not a verb phrase like "go back to Baguio" where "to" was
  // part of "want to go to …". Reject anything that starts with a movement verb.
  const toMatch = transcript.match(
    /\bto\s+([A-Za-z0-9\s.,'"\-]+?)(?=\s+(?:please|now|this|for|can|that|,|\.)|$)/i,
  );
  if (toMatch) {
    const candidate = toMatch[1].trim();
    if (!/^(go|back|drive|walk|navigate|head|get|route|take|return)\b/i.test(candidate)) {
      return candidate;
    }
  }

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

/**
 * Returns true when the utterance mentions multiple stops or events at once,
 * meaning the local intercept cannot handle it — ChatWonder must extract all locations.
 */
export function isMultiEventUtterance(transcript: string): boolean {
  // Two or more distinct time markers → multiple events in one sentence
  const timeHits = (transcript.match(
    /\b(this morning|this afternoon|this evening|tonight|for lunch|for dinner|for breakfast|in the morning|in the afternoon|in the evening)\b/gi,
  ) ?? []).length;
  if (timeHits >= 2) return true;

  // Multiple "going to / heading to / driving to <place>" patterns
  const goingToHits = (transcript.match(/\b(going to|heading to|driving to)\s+[A-Za-z]/gi) ?? []).length;
  if (goingToHits >= 2) return true;

  // Sequential connectors implying a series of stops announced together
  if (/\band\s+(finally|then|also|afterwards)\s+(going|heading|we'?ll\s+be)\b/i.test(transcript)) return true;
  if (/\bwe'?ll\s+(also\s+)?be\s+going\s+to\b/i.test(transcript)) return true;

  // Two or more location anchors: "in/at/to [place]" excluding determiners/digits/time words
  // Case-insensitive so lowercase speech-recognition output ("in sm baguio") is caught too
  const locationAnchorHits = (transcript.match(
    /\b(?:in|at|to)\s+(?!the\s|a\s|an\s|this\s|that\s|my\s|our\s|\d)[a-zA-Z]/gi,
  ) ?? []).length;
  if (locationAnchorHits >= 2) return true;

  // Two or more distinct standalone event types (meeting + lunch ≠ "dinner date" which is one)
  const standaloneEventHits = new Set(
    (transcript.match(/\b(meeting|lunch|dinner|breakfast|appointment|conference|session|gym|wedding|party)\b/gi) ?? [])
      .map((w) => w.toLowerCase()),
  ).size;
  if (standaloneEventHits >= 2) return true;

  // One location anchor + a standalone event type anywhere in the sentence
  // e.g. "date in SM Baguio and lunch in La Union" — catches mixed phrasing
  if (locationAnchorHits >= 1 && standaloneEventHits >= 1) return true;

  return false;
}

/**
 * Extracts all location names from a multi-event transcript by splitting on
 * "and" / "," so each clause is processed independently — avoiding the
 * boundary ambiguity that trips up a single-pass regex.
 *
 * "meeting in SM Baguio at 7am, lunch in La Union, going home to Tagudin"
 * → ["SM Baguio", "La Union", "Tagudin"]
 */
export function extractAllLocationsFromTranscript(transcript: string): string[] {
  // Split on "and" or "," to get one clause per potential stop
  const segments = transcript.split(/\band\b|,/i);
  const locations: string[] = [];

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    // Stopword lookahead — stop capture before these common words or punctuation.
    // Using greedy {0,2} + lookahead: engine backtracks if lookahead fails at max length,
    // so "sm baguio this morning" → tries "sm baguio this", fails at "morning", backtracks
    // to "sm baguio" → lookahead sees " this" → passes → captures "sm baguio" ✓
    const STOP = `(?=\\s+(?:this\\b|the\\b|at\\s+\\d|for\\s+\\w|and\\b|to\\b|so\\b|have\\b|with\\b|going\\b|will\\b|be\\b|my\\b|it\\b|there\\b)|[,.]|\\s*$)`;

    // "in [place]" — max 3 words, stop at common words
    const inM = s.match(
      new RegExp(`\\bin\\s+(?!the\\b|a\\b|an\\b|this\\b|that\\b|my\\b|our\\b)(\\w+(?:\\s+\\w+){0,2})${STOP}`, "i"),
    );
    if (inM) { locations.push(inM[1].trim()); continue; }

    // "at [place]" — exclude bare times like "at 7am", max 3 words
    const atM = s.match(
      new RegExp(`\\bat\\s+(?!\\d)(\\w+(?:\\s+\\w+){0,2})${STOP}`, "i"),
    );
    if (atM) { locations.push(atM[1].trim()); continue; }

    // "to [place]" — exclude "to the/a/home", max 2 words
    const toM = s.match(
      new RegExp(`\\bto\\s+(?!the\\b|a\\b|an\\b|home\\b)(\\w+(?:\\s+\\w+){0,1})${STOP}`, "i"),
    );
    if (toM) { locations.push(toM[1].trim()); continue; }

    // Bare location after connector — e.g. "and la union this afternoon"
    // Strip leading filler/event words then take up to 3 words
    const bareM = s.match(
      new RegExp(`^(?:(?:a|an|my|the)\\s+)?(?:(?:lunch|dinner|breakfast|date|meeting|appointment)\\s+(?:date\\s+)?)?(\\w+(?:\\s+\\w+){0,2})${STOP}`, "i"),
    );
    if (bareM) {
      const loc = bareM[1].trim();
      if (loc.length > 2 && !/^(and|the|a|an|i|my|our|this|that|go|going|will|be|have|had)\b/i.test(loc)) {
        locations.push(loc);
      }
    }
  }

  return [...new Set(locations.filter((l) => l.length > 1))];
}

/**
 * Parses a timeBlock string like "7am", "noon", "this afternoon" into minutes
 * from midnight. Returns null if the string can't be parsed.
 */
export function parseTimeBlock(timeBlock: string): number | null {
  const lower = timeBlock.toLowerCase().trim();

  const m = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (m) {
    let hours = parseInt(m[1]);
    const minutes = parseInt(m[2] ?? "0");
    const ampm = m[3];
    if (ampm === "pm" && hours < 12) hours += 12;
    else if (ampm === "am" && hours === 12) hours = 0;
    else if (!ampm && hours < 7) hours += 12; // bare "3:00" → treat as 3pm
    return hours * 60 + minutes;
  }

  if (/\bnoon\b|\blunch\b/.test(lower)) return 12 * 60;
  if (/\bmorning\b/.test(lower)) return 9 * 60;
  if (/\bafternoon\b/.test(lower)) return 13 * 60;
  if (/\bevening\b/.test(lower)) return 18 * 60;
  if (/\bnight\b/.test(lower)) return 20 * 60;

  return null;
}

function formatTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  const ampm = h < 12 ? "am" : "pm";
  const displayH = h % 12 || 12;
  return m > 0
    ? `${displayH}:${m.toString().padStart(2, "0")}${ampm}`
    : `${displayH}${ampm}`;
}

/**
 * Builds a precise arrival/departure narration using each stop's scheduled
 * timeBlock and actual route leg durations.
 *
 * e.g. "Leave by 6:45am to reach SM Baguio at 7am, then La Union at 12pm,
 *       arriving Tagudin around 2:30pm."
 */
export function buildPreciseETANarration(
  stops: Array<{ name: string; timeBlock?: string }>,
  routes: Array<{ duration: number }>,
): string {
  const parts: string[] = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const travelMins = i < routes.length ? Math.round(routes[i].duration / 60) : 0;
    const scheduledMins = stop.timeBlock ? parseTimeBlock(stop.timeBlock) : null;

    if (scheduledMins !== null) {
      const arrivalStr = formatTime(scheduledMins);
      if (i === 0 && travelMins > 0) {
        const departStr = formatTime(scheduledMins - travelMins);
        parts.push(`leave by ${departStr} to reach ${stop.name} at ${arrivalStr}`);
      } else {
        parts.push(`${stop.name} at ${arrivalStr}`);
      }
    } else if (travelMins > 0) {
      parts.push(`${stop.name} in about ${travelMins} min from the previous stop`);
    }
  }

  if (parts.length === 0) return "";
  if (parts.length === 1) return ` ${parts[0]}.`;
  const last = parts.pop()!;
  return ` ${parts.join(", then ")}, then ${last}.`;
}

/**
 * Returns true when any of the top 3 geocode results are > 50 km apart from
 * the first — catches cases where proximity-based ranking hides a distant
 * same-name location (e.g. "La Union Province" vs "La Union St, Olongapo").
 */
export function isAmbiguousGeocode(results: GeocodeResult[]): boolean {
  if (results.length < 2) return false;
  for (let i = 1; i < Math.min(results.length, 3); i++) {
    if (haversineKm(results[0].lat, results[0].lng, results[i].lat, results[i].lng) > 50) return true;
  }
  return false;
}

/**
 * Builds a natural-language disambiguation question listing the top candidates.
 */
export function buildDisambiguationQuestion(locationName: string, candidates: GeocodeResult[]): string {
  const top = candidates.slice(0, 3);
  if (top.length === 2) {
    return `I found two places called "${locationName}" — option 1: ${top[0].address}, or option 2: ${top[1].address}. Which one did you mean?`;
  }
  const list = top.map((r, i) => `option ${i + 1}: ${r.address}`).join("; ");
  return `I found multiple places called "${locationName}" — ${list}. Which one did you mean?`;
}

/**
 * Tries to match a user reply ("the first one", "option 2", "Ilocos Sur") against
 * a list of geocode candidates. Returns the matched candidate or null.
 */
export function matchCandidateFromTranscript(
  transcript: string,
  candidates: GeocodeResult[],
): GeocodeResult | null {
  const lower = transcript.toLowerCase();

  // Ordinal / explicit option references
  const ORDINALS: Record<string, number> = {
    "option 1": 0, "option one": 0, "number one": 0, first: 0, "1st": 0,
    "option 2": 1, "option two": 1, "number two": 1, second: 1, "2nd": 1,
    "option 3": 2, "option three": 2, "number three": 2, third: 2, "3rd": 2,
  };
  for (const [phrase, idx] of Object.entries(ORDINALS)) {
    if (lower.includes(phrase) && candidates[idx]) return candidates[idx];
  }

  // Address / name token matching — pick candidate with most matching tokens
  let bestMatch: GeocodeResult | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const tokens = candidate.address
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((tok) => tok.length > 3);
    const score = tokens.filter((tok) => lower.includes(tok)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  if (bestScore > 0) return bestMatch;

  return null;
}

/** Embeds map context into a chat-wonder input string. */
export function buildMapInput(
  transcript: string,
  loc: { lat: number; lng: number } | null | undefined,
  dest: { name?: string; address?: string; lat: number; lng: number } | null | undefined,
  routeActive: boolean,
  pendingEvents?: Array<{ eventName: string; timeLabel: string }>,
  prefix: string = "[stylist]"
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

  return `${prefix}${ctx} ${transcript}`;
}
