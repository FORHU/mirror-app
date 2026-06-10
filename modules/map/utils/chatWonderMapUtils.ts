import type { NearbyPOI, GeocodeResult } from "../services/map.service";
import type { ChatWonderMapsPlace } from "@/modules/shared/api/chat-wonder.service";

/**
 * Returns true when the query likely refers to a specific named venue
 * (school, church, mall, hospital, etc.) rather than a street or region.
 * Matches full venue-type words in English, French, Spanish, German, and Italian,
 * plus standalone ALL-CAPS tokens (2–6 chars) which are almost always institutional
 * abbreviations (e.g. "SLU", "UPMC", "UB") regardless of country.
 * We deliberately do NOT pre-expand abbreviations — Mapbox resolves them correctly
 * when proximity coordinates are provided.
 */
const VENUE_ABBREV_RE = /\b[A-Z]{2,6}\b/;
const VENUE_FULL_RE = new RegExp(
  "\\b(" +
    // English
    "mall|center|centre|restaurant|cafe|cafeteria|church|chapel|cathedral|shrine|" +
    "school|university|college|academy|institute|hospital|clinic|hotel|resort|" +
    "park|market|museum|library|gym|spa|station|terminal|grotto|convent|" +
    "monastery|campus|complex|plaza|pharmacy|theatre|theater|cinema|gallery|" +
    // French (accented + unaccented forms — Whisper preserves diacritics)
    "musée|musee|" + // musée
    "école|ecole|" + // école
    "gare|" +
    "hôpital|hopital|" + // hôpital
    "église|eglise|" + // église
    "cathédrale|cathedrale|" + // cathédrale
    "université|universite|" + // université
    "bibliothèque|bibliotheque|" + // bibliothèque
    "théâtre|theatre|" + // théâtre (also in English above)
    "cinéma|cinema|" + // cinéma (also in English above)
    "galerie|mairie|pharmacie|palais|stade|marché|marche|" +
    "lycée|lycee|" + // lycée (French high school)
    "arrondissement|quartier|" +
    // Spanish
    "escuela|universidad|iglesia|mercado|parque|farmacia|" +
    // German
    "schule|kirche|krankenhaus|bahnhof|markt|" +
    // Italian
    "scuola|chiesa|ospedale|stazione|farmacia" +
    ")\\b",
  "i",
);

export function isVenueName(name: string): boolean {
  return VENUE_FULL_RE.test(name) || VENUE_ABBREV_RE.test(name);
}

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
  const typeEntry = place.types.map((t) => PLACE_TYPE_MAP[t]).find(Boolean) ?? {
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
        ((p.rating ?? 0) / 5) * 0.6 + (1 - (p.distance ?? 0) / maxDist) * 0.4,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.poi);
}

export function buildPOITTS(pois: NearbyPOI[]): string {
  if (pois.length === 1)
    return `${pois[0].name} looks like a great choice. Want to head there?`;
  if (pois.length === 2)
    return `There's ${pois[0].name} or ${pois[1].name}. Which one?`;
  const last = pois[pois.length - 1].name;
  const rest = pois
    .slice(0, -1)
    .map((p) => p.name)
    .join(", ");
  return `How about ${rest}, or ${last}? Which one sounds good?`;
}

const ORDINALS: Record<string, number> = {
  first: 0,
  one: 0,
  "number one": 0,
  "option one": 0,
  "option 1": 0,
  "1st": 0,
  second: 1,
  two: 1,
  "number two": 1,
  "option two": 1,
  "option 2": 1,
  "2nd": 1,
  third: 2,
  three: 2,
  "number three": 2,
  "option three": 2,
  "option 3": 2,
  "3rd": 2,
  fourth: 3,
  four: 3,
  "number four": 3,
  "option four": 3,
  "option 4": 3,
  "4th": 3,
  fifth: 4,
  five: 4,
  "number five": 4,
  "option five": 4,
  "option 5": 4,
  "5th": 4,
};

/**
 * Returns the 0-based index encoded by the first ordinal phrase found in the
 * transcript, or null if none is found.  Longer phrases are matched first so
 * "option three" beats "three".
 */
export function extractOrdinalIndex(transcript: string): number | null {
  const lower = transcript.toLowerCase();
  // Sort by phrase length descending so multi-word phrases win over single words
  const sorted = Object.entries(ORDINALS).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [phrase, idx] of sorted) {
    if (lower.includes(phrase)) return idx;
  }
  return null;
}

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
  // First pass: full name substring match (highest confidence)
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

  // Second pass: segment match — handles names like "Foam Coffee - Baguio"
  // where the user says "foam coffee" without the location qualifier.
  // Score = sum of matched segment lengths so "foam coffee baguio" beats "foam coffee" alone.
  for (const poi of pois) {
    const segments = poi.name
      .toLowerCase()
      .split(/\s*[-+|,()\/]\s*/)
      .filter((s) => s.length > 2);
    const score = segments
      .filter((seg) => lower.includes(seg))
      .reduce((sum, seg) => sum + seg.length, 0);
    if (score > bestLen) {
      bestMatch = poi;
      bestLen = score;
    }
  }
  if (bestMatch) return bestMatch;

  // Tier 3 — superlative
  if (/\b(closest|nearest)\b/.test(lower)) {
    return (
      [...pois].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0] ?? null
    );
  }
  if (/\b(highest.rated|best.rated|top.rated|best)\b/.test(lower)) {
    return (
      [...pois].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null
    );
  }
  if (/\b(cheapest|least.expensive)\b/.test(lower)) {
    return (
      [...pois].sort(
        (a, b) => (a.priceLevel ?? 999) - (b.priceLevel ?? 999),
      )[0] ?? null
    );
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
  /\b(that'?s all|done|no more|no more stops|let'?s go|start|start navigation|that'?s it|finished|ok go|okay go|set|we'?re good|that will do)\b|\bgo\b(?!\s+to\b)/i;

export function isFinishPhrase(transcript: string): boolean {
  return FINISH_PHRASE_PATTERN.test(transcript);
}

const CLEAR_ROUTE_PATTERN =
  /\b(clear(?: the)? (?:route|map|itinerary|trip|stops?)|reset(?: the)? (?:route|map|itinerary|trip)|start (?:over|fresh|again)|erase(?: the)? route|cancel(?: the)? (?:route|trip)|delete(?: the)? route|remove(?: all)? stops?|new (?:route|trip|itinerary))\b/i;

export function isClearRoutePhrase(transcript: string): boolean {
  return CLEAR_ROUTE_PATTERN.test(transcript);
}

const ADDRESS_QUERY_PATTERN =
  /\bwhat(?:'s|\s+is)\s+(?:the\s+)?address\b|\baddress\s+of\b/i;

/** Returns true when the transcript is asking for a POI's address. */
export function isAddressQuery(transcript: string): boolean {
  return ADDRESS_QUERY_PATTERN.test(transcript);
}

const RATING_QUERY_PATTERN =
  /\bwhat(?:'s|\s+is|\s+are)\s+(?:the\s+)?(?:rating|stars?|score|reviews?)\b|\bhow\s+(?:(?:well?|good|highly)\s+)?(?:is\s+(?:it\s+)?)?rated?\b|\bhow\s+(?:is|was)\s+.+?\s+rated?\b|\brating\s+of\b|\bhow\s+many\s+stars\b/i;

/** Returns true when the transcript is asking for a POI's rating or review score. */
export function isRatingQuery(transcript: string): boolean {
  return RATING_QUERY_PATTERN.test(transcript);
}

/**
 * Tries to extract a location name from a natural-language transcript.
 * "meeting at Burnham Park this morning" → "Burnham Park"
 * "lunch at Session Road" → "Session Road"
 * "going to SM City Baguio" → "SM City Baguio"
 */
// Words that can appear after a place name in speech but are NOT part of the
// location itself. Strip these from the tail of any extracted candidate so that
// "la union table launch" → "la union" and geocoding finds the right province.
const TRAILING_EVENT_RE =
  /\s+(?:table|launch|event|events|party|parties|meeting|meetings|breakfast|lunch|dinner|brunch|date|night|session|conference|concert|show|game|match|class|gym|practice|rehearsal|ceremony|wedding|appointment|interview|gathering|meetup|seminar|workshop)\s*$/i;

function stripTrailingEventWords(location: string): string {
  let result = location;
  let prev: string;
  do {
    prev = result;
    result = result.replace(TRAILING_EVENT_RE, "").trim();
  } while (result !== prev && result.length > 0);
  return result.length > 0 ? result : location;
}

export function extractLocationFromTranscript(
  transcript: string,
): string | null {
  // "at [Location]" — excludes "at [digit]" time refs; stops at comma (city, province
  // notation), a second "at [digit]" (e.g. "SM City Baguio at 8:30"), any bare digit
  // (e.g. "6pm"), or common clause starters.
  const atMatch = transcript.match(
    /\bat\s+(?!\d)([A-Za-z0-9\s.,'"\-]+?)(?=[,]|\s+(?:this\b|tonight|at\s+\d|\d|for\s+(?:lunch|dinner|breakfast)|in\s+the\s+(?:morning|afternoon|evening)|please|can\s+you|that|and\b)|$)/i,
  );
  if (atMatch)
    return stripTrailingEventWords(atMatch[1].trim().replace(/[,.\s]+$/, ""));

  // "to [Location]" — scan ALL occurrences so "want to go to La Union" skips "to go"
  // (movement verb) and correctly extracts "La Union".
  // Stop at "here"/"in" so "bgh hospital in baguio city" → "bgh hospital" (city appended below).
  const toRe =
    /\bto\s+([A-Za-z0-9\s.,'"\-]+?)(?=[,]|\s+(?:please|now|this|for|can|that|after\b|then\b|in\b|with\b|to\b|and\b|here\b)|$)/gi;
  let toMatch: RegExpExecArray | null;
  while ((toMatch = toRe.exec(transcript)) !== null) {
    const candidate = stripTrailingEventWords(
      toMatch[1].trim().replace(/[,.\s]+$/, ""),
    );
    if (
      !/^(go|back|drive|walk|navigate|head|get|route|take|return)\b/i.test(
        candidate,
      )
    ) {
      // "bgh hospital in baguio city" → append city so geocoder gets the full
      // context ("bgh hospital baguio city") and surfaces the correct POI.
      // Also handles "here in [city]" variant ("slu bonifacio here in baguio").
      const inCity = transcript.match(
        /\b(?:here\s+)?in\s+([A-Za-z][A-Za-z\s]{1,25}?)(?:\s*$|\s+\b(?:please|ok|now|after|then)\b)/i,
      );
      if (inCity) {
        const city = inCity[1].trim().split(/\s+/).slice(0, 3).join(" ");
        return `${candidate} ${city}`;
      }
      return candidate;
    }
  }

  // "in [Location]" planning phrasing:
  // "I have a date in La Union" → "La Union"
  // "I have a meeting in SM Baguio City 7:00 a.m." → "SM Baguio City"
  // "going home in Tagudin Ilocos Sur in evening" → "Tagudin Ilocos Sur"
  // Stops at comma (city, province), any digit (bare times like "6pm"), or clause starters.
  const inMatch = transcript.match(
    /\bin\s+(?!the\s)([A-Za-z0-9\s.,'"\-]+?)(?=[,]|\s+(?:this\b|today\b|tonight\b|tomorrow\b|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend)|\d|at\s+\d|in\s+(?:the\s+)?(?:morning|afternoon|evening|night)\b|for\s+(?:lunch|dinner|breakfast)|please|can\s+you|that|and\b)|$)/i,
  );
  if (inMatch)
    return stripTrailingEventWords(inMatch[1].trim().replace(/[,.\s]+$/, ""));

  return null;
}

const ITINERARY_PATTERN =
  /\b(i have|i've got|i need to go|going to|i'll be at|my|there's a)\b.{0,30}\b(meeting|lunch|dinner|breakfast|appointment|event|date|session|class|gym|party|wedding|conference)\b/i;

const TIME_PATTERN =
  /\b(this morning|this afternoon|this evening|tonight|tomorrow|at \d|for lunch|for dinner|in the morning|in the afternoon|in the evening|morning meeting|afternoon|evening)\b/i;

// Catches bare event statements without a preamble or time word, e.g. "dinner at Marco Polo",
// "meeting at SM City", "breakfast in Baguio", "gym with coach at BGC".
const BARE_EVENT_PATTERN =
  /\b(meeting|lunch|dinner|breakfast|appointment|gym|party|wedding|conference|class|session)\s+(?:at|in|with|near)\b/i;

/** Returns true when the transcript looks like an itinerary stop, not a place search. */
export function isItineraryPhrase(transcript: string): boolean {
  return (
    ITINERARY_PATTERN.test(transcript) ||
    TIME_PATTERN.test(transcript) ||
    BARE_EVENT_PATTERN.test(transcript)
  );
}

const EVENT_TYPE_PATTERNS: Array<{ pattern: RegExp; eventType: string }> = [
  { pattern: /\b(breakfast)\b/i, eventType: "breakfast" },
  { pattern: /\b(lunch)\b/i, eventType: "lunch" },
  { pattern: /\b(dinner)\b/i, eventType: "dinner" },
  { pattern: /\b(meeting|conference)\b/i, eventType: "meeting" },
  { pattern: /\b(date)\b/i, eventType: "date" },
  { pattern: /\b(gym|workout)\b/i, eventType: "gym" },
  { pattern: /\b(party|wedding|celebration)\b/i, eventType: "event" },
  { pattern: /\b(appointment)\b/i, eventType: "appointment" },
];

/** Extracts the event type from a transcript (e.g. "lunch" → "lunch", "meeting" → "meeting"). */
export function extractEventTypeFromTranscript(
  transcript: string,
): string | null {
  for (const { pattern, eventType } of EVENT_TYPE_PATTERNS) {
    if (pattern.test(transcript)) return eventType;
  }
  return null;
}

/**
 * Returns true when the utterance mentions multiple stops or events at once,
 * meaning the local intercept cannot handle it — ChatWonder must extract all locations.
 */
export function isMultiEventUtterance(transcript: string): boolean {
  // Two or more distinct time markers → multiple events in one sentence
  const timeHits = (
    transcript.match(
      /\b(this morning|this afternoon|this evening|tonight|for lunch|for dinner|for breakfast|in the morning|in the afternoon|in the evening)\b/gi,
    ) ?? []
  ).length;
  if (timeHits >= 2) return true;

  // Multiple "going to / heading to / driving to <place>" patterns
  const goingToHits = (
    transcript.match(/\b(going to|heading to|driving to)\s+[A-Za-z]/gi) ?? []
  ).length;
  if (goingToHits >= 2) return true;

  // Sequential connectors implying a series of stops announced together
  if (
    /\band\s+(finally|then|also|afterwards)\s+(going|heading|we'?ll\s+be)\b/i.test(
      transcript,
    )
  )
    return true;
  if (/\bwe'?ll\s+(also\s+)?be\s+going\s+to\b/i.test(transcript)) return true;

  // Two or more location anchors: "in/at/to [place]" excluding determiners, digits,
  // time-of-day words, and common verb infinitives so "in the evening", "to have lunch",
  // "to meet my girlfriend", etc. don't count.
  const locationAnchorHits = (
    transcript.match(
      /\b(?:in|at|to)\s+(?!the\s|a\s|an\s|this\s|that\s|my\s|our\s|\d|evening\b|morning\b|afternoon\b|night\b|noon\b|have\b|go\b|get\b|be\b|make\b|do\b|take\b|give\b|come\b|see\b|know\b|want\b|find\b|try\b|leave\b|call\b|eat\b|drink\b|meet\b|visit\b|buy\b|grab\b|check\b|pay\b|stay\b|run\b|walk\b|drive\b|join\b|bring\b|pick\b|use\b|tell\b|ask\b|spend\b|enjoy\b|sleep\b|rest\b|work\b|study\b|live\b|wait\b|stop\b)[a-zA-Z]/gi,
    ) ?? []
  ).length;
  if (locationAnchorHits >= 2) return true;

  // Two or more distinct standalone event types in one sentence
  // e.g. "meeting at SM Baguio… lunch at La Union" (meeting + lunch = 2 types)
  const standaloneEventHits = new Set(
    (
      transcript.match(
        /\b(meeting|lunch|dinner|breakfast|appointment|conference|session|gym|wedding|party)\b/gi,
      ) ?? []
    ).map((w) => w.toLowerCase()),
  ).size;
  if (standaloneEventHits >= 2) return true;

  // Navigation phrase + comma or "and" separated bare locations.
  // e.g. "i want to go to SM baguio, san fernando, tagudin ilocos sur"
  //      "i want to go to la union and vigan ilocos sur"
  // Voice STT never inserts commas, so we must also check for spoken "and".
  // The location-anchor check above only counts preposition-prefixed locations, so a
  // single "to [first stop]" followed by bare comma/and segments scores only 1. Detect
  // these by confirming the navigation intent and letting extractAllLocationsFromTranscript
  // confirm there are genuinely ≥ 2 distinct place segments.
  if (
    NAVIGATION_PATTERN.test(transcript) &&
    (transcript.includes(",") || /\b(?:and|then|also|plus)\b/i.test(transcript))
  ) {
    if (extractAllLocationsFromTranscript(transcript).length >= 2) return true;
  }

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
export function extractAllLocationsFromTranscript(
  transcript: string,
): string[] {
  // Split on "and" or "," to get one clause per potential stop
  const segments = transcript.split(/\b(?:and|then|also|plus)\b|,/i);
  const locations: string[] = [];

  for (const seg of segments) {
    // Strip leading connector/ordinal words that appear when the user's
    // sentence is split on commas: "then lastly saint louis university..."
    // → "saint louis university...". Keep prepositions (to/at/in) intact
    // since the patterns below rely on them.
    const s = seg
      .trim()
      .replace(
        /^(?:(?:then|lastly|firstly|finally|next|also|after\s+that)\s+)+/i,
        "",
      )
      .trim();
    if (!s) continue;

    // Stop pattern — capture ends before these common words or punctuation.
    // All patterns use LAZY matching so they expand word-by-word until a stop is hit:
    //   "sm baguio this morning"         → expands "sm"→"sm baguio", stops at "this" ✓
    //   "baguio in the morning"          → stops at "in" (time-of-day prep) ✓
    //   "la union san fernando to…"      → expands until second "to" ✓
    const STOP = `(?=\\s+(?:this\\b|the\\b|at\\s+\\d|for\\s+\\w|and\\b|to\\b|so\\b|in\\b|have\\b|with\\b|going\\b|will\\b|be\\b|my\\b|it\\b|there\\b)|[,.]|\\s*$)`;

    // Helper: strips filler words from the text before a preposition to extract a POI prefix.
    // "going to zoo" → "zoo", "having a lunch" → "", "i'll be at" → ""
    const extractPOIPrefix = (raw: string): string =>
      raw
        .replace(
          /\b(?:going|heading|having|eating|visiting|stopping|i(?:'ll)?|will|am|be|a|an|the|my|our|and|then|also|finally|after(?:\s+that)?|first|second|third|to|for|of)\b\s*/gi,
          "",
        )
        .replace(
          /\b(?:lunch|dinner|breakfast|brunch|meal|meeting|appointment|date|session|conference|event|party)\b\s*/gi,
          "",
        )
        .trim();

    // Regex that matches a following "in [place]" immediately after the current match.
    const followInRe = new RegExp(
      `^\\s+in\\s+(?!the\\b|a\\b|an\\b|this\\b)(\\w+(?:\\s+\\w+)*?)${STOP}`,
      "i",
    );

    // "in [place]" — lazy, stop at common words.
    // Also captures any POI prefix before "in" (e.g. "zoo in ilocos sur" → "zoo ilocos sur")
    // and any second "in [place]" after the match (e.g. "Greenwich in la union" → "Greenwich la union").
    const inM = s.match(
      new RegExp(
        `\\bin\\s+(?!the\\b|a\\b|an\\b|this\\b|that\\b|my\\b|our\\b)(\\w+(?:\\s+\\w+)*?)${STOP}`,
        "i",
      ),
    );
    if (inM) {
      const loc = inM[1].trim();
      const poi = extractPOIPrefix(s.slice(0, inM.index!));
      const isVerb =
        /^(?:go|be|have|get|make|do|take|come|see|find|try|eat|drink|meet|buy|grab|pay|run|walk|drive|join|bring|pick)\b/i.test(
          poi,
        );
      const prefix = poi.length > 1 && !isVerb ? poi : "";
      const followIn = s.slice(inM.index! + inM[0].length).match(followInRe);
      const suffix = followIn ? followIn[1].trim() : "";
      locations.push([prefix, loc, suffix].filter(Boolean).join(" "));
      continue;
    }

    // "at [place]" — exclude bare times like "at 7am".
    // Also checks for a following "in [place]" (e.g. "lunch at Greenwich in la union").
    const atM = s.match(
      new RegExp(`\\bat\\s+(?!\\d)(\\w+(?:\\s+\\w+)*?)${STOP}`, "i"),
    );
    if (atM) {
      const dest = atM[1].trim();
      const followIn = s.slice(atM.index! + atM[0].length).match(followInRe);
      const query = followIn ? `${dest} ${followIn[1].trim()}` : dest;
      locations.push(query);
      continue;
    }

    // "to [place]" — exclude "to the/a/home/have/be/go".
    // Also checks for a following "in [place]" (e.g. "going to zoo in ilocos sur").
    const toM = s.match(
      new RegExp(
        `\\bto\\s+(?!the\\b|a\\b|an\\b|home\\b|have\\b|be\\b|go\\b|get\\b|this\\b)(\\w+(?:\\s+\\w+)*?)${STOP}`,
        "i",
      ),
    );
    if (toM) {
      const dest = toM[1].trim();
      const followIn = s.slice(toM.index! + toM[0].length).match(followInRe);
      const query = followIn ? `${dest} ${followIn[1].trim()}` : dest;
      locations.push(query);
      continue;
    }

    // Bare location after connector — e.g. "and la union this afternoon"
    // Skip this fallback when the segment looks like a province/region qualifier that
    // appeared after a comma split, e.g. "ilocos norte at 8am" from splitting
    // "laoag, ilocos norte at 8am". Those segments have a time anchor ("at \d") but
    // no location preposition, so they should not be treated as standalone stops.
    if (!/\bat\s+\d/i.test(s) && !/\bin\s+\d/i.test(s)) {
      const bareM = s.match(
        new RegExp(
          `^(?:(?:a|an|my|the)\\s+)?(?:(?:lunch|dinner|breakfast|date|meeting|appointment)\\s+(?:date\\s+)?)?(\\w+(?:\\s+\\w+)*?)${STOP}`,
          "i",
        ),
      );
      if (bareM) {
        const loc = bareM[1].trim();
        if (
          loc.length > 2 &&
          !/^(and|then|lastly|firstly|finally|next|the|a|an|i|my|our|this|that|go|going|will|be|have|had|hang|chill|eat|drink|relax|rest|explore|walk|meet|see|watch|play|shop|stay|work|sleep|sit|stand|wait|check|look|enjoy|spend|try|come|find|think|feel|hope|ask|help|take|keep|run|grab|visit|stop|drop|browse|wander|swim|dance|do|get|make|want|give|know|show|tell|bring|buy|rent|open|start|finish|leave|arrive|ride|drive|fly|climb)\b/i.test(
            loc,
          )
        ) {
          locations.push(loc);
        }
      }
    }
  }

  return [...new Set(locations.filter((l) => l.length > 1))];
}

/**
 * Like extractAllLocationsFromTranscript but also returns per-segment eventType
 * and timeBlock, enabling context-aware POI queries for each stop.
 * "meeting at SM Baguio at 7am, lunch at La Union at noon"
 *   → [{ location: "SM Baguio", eventType: "meeting", timeBlock: "7am" },
 *      { location: "La Union",  eventType: "lunch",   timeBlock: "noon" }]
 */
export function extractLocationsWithMeta(transcript: string): Array<{
  location: string;
  eventType: string | null;
  timeBlock: string | null;
}> {
  const segments = transcript.split(/\b(?:and|then|also|plus)\b|,/i);
  const results: Array<{
    location: string;
    eventType: string | null;
    timeBlock: string | null;
  }> = [];
  const seen = new Set<string>();

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    const locations = extractAllLocationsFromTranscript(s);
    for (const location of locations) {
      if (!seen.has(location.toLowerCase())) {
        seen.add(location.toLowerCase());
        results.push({
          location,
          eventType: extractEventTypeFromTranscript(s),
          timeBlock: extractTimeBlockFromTranscript(s),
        });
      }
    }
  }

  return results;
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

/**
 * Extracts a time reference string from a transcript for use as a timeBlock.
 * Returns the raw matched string that parseTimeBlock can then interpret.
 * "meeting at SM Baguio at 7am" → "7am"
 * "going to La Union for lunch" → "lunch"
 * "heading to Burnham this morning" → "morning"
 */
export function extractTimeBlockFromTranscript(
  transcript: string,
): string | null {
  // "at 7am", "at 7:30 pm" — requires explicit am/pm
  const atClock = transcript.match(
    /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  );
  if (atClock) return atClock[1].trim();

  // Bare clock with explicit am/pm anywhere: "7am", "7:00pm"
  const bareClock = transcript.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (bareClock) return bareClock[1].trim();

  // Noon
  if (/\bnoon\b/i.test(transcript)) return "noon";

  // Meal anchors → fuzzy times parseTimeBlock already maps
  const meal = transcript.match(/\b(breakfast|lunch|dinner)\b/i);
  if (meal) return meal[1].toLowerCase();

  // Time of day
  const tod = transcript.match(/\b(morning|afternoon|evening|night)\b/i);
  if (tod) return tod[1].toLowerCase();

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
    const travelMins =
      i < routes.length ? Math.round(routes[i].duration / 60) : 0;
    const scheduledMins = stop.timeBlock
      ? parseTimeBlock(stop.timeBlock)
      : null;

    if (scheduledMins !== null) {
      const arrivalStr = formatTime(scheduledMins);
      if (i === 0 && travelMins > 0) {
        const departStr = formatTime(scheduledMins - travelMins);
        parts.push(
          `leave by ${departStr} to reach ${stop.name} at ${arrivalStr}`,
        );
      } else if (i > 0 && travelMins > 0) {
        const departStr = formatTime(scheduledMins - travelMins);
        parts.push(
          `leave ${stops[i - 1].name} by ${departStr} to reach ${stop.name} at ${arrivalStr}`,
        );
      } else {
        parts.push(`${stop.name} at ${arrivalStr}`);
      }
    } else if (travelMins > 0) {
      parts.push(
        `${stop.name} in about ${travelMins} min from the previous stop`,
      );
    }
  }

  if (parts.length === 0) return "";
  if (parts.length === 1) return ` ${parts[0]}.`;
  const last = parts.pop()!;
  return ` ${parts.join(", then ")}, then ${last}.`;
}

/**
 * Formats total route distance and duration for TTS after a stop is confirmed.
 * Single stop: "It's about 25 minutes away, 12 km."
 * Multiple stops: "Total trip: 12.3 km, about 38 minutes."
 */
export function buildRouteSummary(
  routes: Array<{ duration: number; distance: number }>,
  stopCount: number,
): string {
  if (routes.length === 0) return "";
  const totalSec = routes.reduce((s, r) => s + r.duration, 0);
  const totalM = routes.reduce((s, r) => s + r.distance, 0);
  if (totalSec <= 0) return "";
  const minutes = Math.round(totalSec / 60);
  const km = totalM / 1000;
  const kmStr = km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  if (stopCount === 1) {
    return ` It's about ${minutes} minute${minutes !== 1 ? "s" : ""} away, ${kmStr}.`;
  }
  return ` Total trip: ${kmStr}, about ${minutes} minute${minutes !== 1 ? "s" : ""}.`;
}

/**
 * Returns true when any of the top 3 geocode results are within 20 km of the
 * first — catches within-region ambiguity (e.g. "Vigan City" vs "Ilocos Sur
 * province center" ~8 km apart) while ignoring same-name places in different
 * regions (>20 km apart), where the top Mapbox result is clearly correct.
 */
export function isAmbiguousGeocode(results: GeocodeResult[]): boolean {
  if (results.length < 2) return false;
  for (let i = 1; i < Math.min(results.length, 3); i++) {
    if (
      haversineKm(
        results[0].lat,
        results[0].lng,
        results[i].lat,
        results[i].lng,
      ) < 20
    )
      return true;
  }
  return false;
}

/**
 * Builds a natural-language disambiguation question listing the top candidates.
 */
export function buildDisambiguationQuestion(
  locationName: string,
  candidates: GeocodeResult[],
): string {
  const top = candidates.slice(0, 3);
  const hint = "You can say the option number or just name the region.";
  if (top.length === 2) {
    return `I found two places called "${locationName}" — option 1: ${top[0].address}, or option 2: ${top[1].address}. Which one did you mean? ${hint}`;
  }
  const list = top.map((r, i) => `option ${i + 1}: ${r.address}`).join("; ");
  return `I found multiple places called "${locationName}" — ${list}. Which one? ${hint}`;
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
    "option 1": 0,
    "option one": 0,
    "number one": 0,
    first: 0,
    "1st": 0,
    "option 2": 1,
    "option two": 1,
    "number two": 1,
    second: 1,
    "2nd": 1,
    "option 3": 2,
    "option three": 2,
    "number three": 2,
    third: 2,
    "3rd": 2,
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

/**
 * Detects "nearest X", "closest X", "find me X near me", "X near my location"
 * patterns and returns the POI search term (e.g. "starbucks", "gas station").
 * Returns null when the phrase isn't a nearby-POI request.
 */
// Maps activity verbs to Google Places categories when no explicit POI noun is given.
const ACTIVITY_TO_CATEGORY: Record<string, string> = {
  eat: "restaurant",
  eating: "restaurant",
  drink: "cafe",
  drinking: "cafe",
  stay: "hotel",
  sleep: "hotel",
  shop: "shopping mall",
  shopping: "shopping mall",
  park: "parking",
  parking: "parking",
  relax: "park",
  relaxing: "park",
  chill: "cafe",
  "hang out": "cafe",
  refuel: "gas station",
  charge: "gas station",
  rest: "cafe",
};

// Maps place/activity keywords to a geocodable destination query + display label.
// Used for cross-feature intent: user says "I want to go hiking" or "let's grab coffee"
// on any non-map page → map page pre-loads with the nearest matching spot.
// Multi-word entries must come first so they match before their single-word substrings.
const PLACE_INTENT_MAP: Record<string, { query: string; label: string }> = {
  // ── Outdoors & sports ──────────────────────────────────────────────────────
  "mountain biking": {
    query: "mountain bike trail",
    label: "Mountain Bike Trail",
  },
  "rock climbing": { query: "climbing area", label: "Rock Climbing" },
  "coffee shop": { query: "cafe", label: "Coffee Shop" },
  "fast food": { query: "fast food restaurant", label: "Fast Food" },
  "food court": { query: "food court", label: "Food Court" },
  hiking: { query: "hiking trail", label: "Hiking Trail" },
  hike: { query: "hiking trail", label: "Hiking Trail" },
  trekking: { query: "trekking trail", label: "Trekking Trail" },
  trek: { query: "trekking trail", label: "Trekking Trail" },
  camping: { query: "campsite", label: "Campsite" },
  camp: { query: "campsite", label: "Campsite" },
  surfing: { query: "surf spot", label: "Surf Spot" },
  surf: { query: "surf spot", label: "Surf Spot" },
  swimming: { query: "swimming area", label: "Swimming Area" },
  swim: { query: "swimming area", label: "Swimming Area" },
  biking: { query: "bike trail", label: "Bike Trail" },
  cycling: { query: "bike trail", label: "Bike Trail" },
  running: { query: "running trail", label: "Running Trail" },
  jogging: { query: "running trail", label: "Running Trail" },
  climbing: { query: "climbing area", label: "Climbing Area" },
  fishing: { query: "fishing spot", label: "Fishing Spot" },
  skiing: { query: "ski resort", label: "Ski Resort" },
  golf: { query: "golf course", label: "Golf Course" },
  tennis: { query: "tennis court", label: "Tennis Court" },
  basketball: { query: "basketball court", label: "Basketball Court" },
  beach: { query: "beach", label: "Beach" },
  picnic: { query: "park", label: "Picnic Spot" },
  // ── Food & drink ───────────────────────────────────────────────────────────
  restaurant: { query: "restaurant", label: "Restaurant" },
  diner: { query: "restaurant", label: "Restaurant" },
  cafe: { query: "cafe", label: "Cafe" },
  coffee: { query: "cafe", label: "Cafe" },
  bar: { query: "bar", label: "Bar" },
  pub: { query: "bar", label: "Bar" },
  pizza: { query: "pizza restaurant", label: "Pizza Place" },
  burger: { query: "burger restaurant", label: "Burger Place" },
  // ── Religious & community ──────────────────────────────────────────────────
  church: { query: "church", label: "Church" },
  cathedral: { query: "cathedral", label: "Cathedral" },
  chapel: { query: "chapel", label: "Chapel" },
  mosque: { query: "mosque", label: "Mosque" },
  temple: { query: "temple", label: "Temple" },
  shrine: { query: "shrine", label: "Shrine" },
  // ── Education ──────────────────────────────────────────────────────────────
  school: { query: "school", label: "School" },
  university: { query: "university", label: "University" },
  college: { query: "college", label: "College" },
  // ── Medical ────────────────────────────────────────────────────────────────
  hospital: { query: "hospital", label: "Hospital" },
  clinic: { query: "clinic", label: "Clinic" },
  pharmacy: { query: "pharmacy", label: "Pharmacy" },
  drugstore: { query: "pharmacy", label: "Pharmacy" },
  dentist: { query: "dental clinic", label: "Dentist" },
  // ── Shopping ───────────────────────────────────────────────────────────────
  mall: { query: "shopping mall", label: "Mall" },
  supermarket: { query: "supermarket", label: "Supermarket" },
  grocery: { query: "grocery store", label: "Grocery Store" },
  market: { query: "market", label: "Market" },
  // ── Services ───────────────────────────────────────────────────────────────
  bank: { query: "bank", label: "Bank" },
  atm: { query: "ATM", label: "ATM" },
  hotel: { query: "hotel", label: "Hotel" },
  hostel: { query: "hostel", label: "Hostel" },
  // ── Leisure ────────────────────────────────────────────────────────────────
  cinema: { query: "cinema", label: "Cinema" },
  museum: { query: "museum", label: "Museum" },
  zoo: { query: "zoo", label: "Zoo" },
  park: { query: "park", label: "Park" },
};

/**
 * Returns a geocodable destination for any place or activity keyword found in
 * the transcript, or null if none is recognised.
 * Multi-word entries are evaluated before single-word ones.
 */
export function extractActivityDestination(
  transcript: string,
): { query: string; label: string } | null {
  const keys = Object.keys(PLACE_INTENT_MAP).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of keys) {
    if (new RegExp(`\\b${key}\\b`, "i").test(transcript)) {
      return PLACE_INTENT_MAP[key];
    }
  }
  return null;
}

export function extractNearbyPOIQuery(transcript: string): string | null {
  // Strip trailing punctuation so "Show me cafes near me." matches the same as
  // "Show me cafes near me" — STT and chip texts often end with a period.
  const t = transcript.replace(/[.,!?]+\s*$/, "").trim();

  // ── Group 1: "nearest / closest X" ──────────────────────────────────────
  const nearestM = t.match(
    /\b(?:nearest|closest)\s+(.+?)(?:\s+(?:near\s+(?:me|my\s+location)|nearby|around\s+(?:here|me))\s*$|\s*$)/i,
  );
  if (nearestM) return nearestM[1].trim() || null;

  // ── Group 2: "find / show / give / get me X" ────────────────────────────
  // "... near me / nearby / around here"
  const findNearM = t.match(
    /\b(?:find|show|give|get)\s+me\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+(?:near(?:\s+me|\s+my\s+location)?|nearby|around\s+(?:here|me))\s*$/i,
  );
  if (findNearM) return findNearM[1].trim() || null;

  // "... here [in / at city]"
  const findHereM = t.match(
    /\b(?:find|show|give|get)\s+me\s+(?:a\s+|an\s+|the\s+)?(.+?)\s+here\b/i,
  );
  if (findHereM) return findHereM[1].trim() || null;

  // ── Group 3: "X near me / X nearby" standalone ──────────────────────────
  const nearMeM = t.match(
    /^(?:can\s+you\s+)?(?:give\s+me\s+)?(?:(?:the|a|an)\s+)?(.+?)\s+(?:near(?:\s+me|\s+my\s+location)?|nearby)\s*$/i,
  );
  if (nearMeM) {
    const candidate = nearMeM[1].trim();
    // Exclude question words, subject pronouns, and command verbs — these indicate
    // the pattern captured a full sentence rather than a bare POI category.
    if (
      candidate &&
      !/^(what|where|how|who|when|i|i'm|i'd|i'll|we|they|suggest|recommend|looking|searching|find|show|give|get)\b/i.test(
        candidate,
      )
    )
      return candidate;
  }

  // ── Group 4: "where" questions ───────────────────────────────────────────
  // "where is / where are [the/a/nearest] X [near/here/around]"
  const whereIsM = t.match(
    /\bwhere(?:'s|\s+is|\s+are)\s+(?:the\s+|a\s+|an\s+)?(?:nearest\s+|closest\s+)?(.+?)\s*(?:near(?:\s+me|\s+my\s+location)?|nearby|around(?:\s+(?:here|me))?|here)\s*$/i,
  );
  if (whereIsM) return whereIsM[1].trim() || null;

  // "where can I eat / drink [specific food]"
  const whereCanFoodM = t.match(
    /\bwhere\s+can\s+i\s+(eat|drink)\s+(?:a\s+|an\s+|some\s+)?(.+?)(?:\s+(?:near(?:\s+me)?|nearby|around\s+here|here)|\s*$)/i,
  );
  if (whereCanFoodM) {
    const food = whereCanFoodM[2].trim();
    // Reject bare location words captured as the food noun ("where can I eat here"
    // → food="here").  Fall back to the activity → category map instead.
    const isLocationWord =
      /^(?:here|nearby|near\s+me|around\s+here|around\s+me)\s*$/i.test(food);
    return !isLocationWord && food
      ? food
      : ACTIVITY_TO_CATEGORY[whereCanFoodM[1].toLowerCase()] || null;
  }

  // "where can I eat / drink / shop / park" — activity only, no food noun
  const whereCanActivityM = t.match(
    /\bwhere\s+can\s+i\s+(eat|drink|sleep|stay|shop|park|relax|chill|refuel)\b/i,
  );
  if (whereCanActivityM)
    return ACTIVITY_TO_CATEGORY[whereCanActivityM[1].toLowerCase()] ?? null;

  // "where can I find / get / buy / grab [a] X"
  const whereCanFindM = t.match(
    /\bwhere\s+can\s+i\s+(?:find|get|buy|grab|try|have)\s+(?:a\s+|an\s+|some\s+)?(.+?)(?:\s+(?:near(?:\s+me)?|nearby|around\s+here|here)|\s*$)/i,
  );
  if (whereCanFindM) {
    const candidate = whereCanFindM[1].trim();
    if (candidate && !/^(something|anything|stuff|it|one)\s*$/.test(candidate))
      return candidate;
  }

  // ── Group 5: "I need / want / crave X" ──────────────────────────────────
  const needWantM = t.match(
    /\bi\s+(?:need|want|crave)\s+(?:a\s+|an\s+|some\s+)?(.+?)\s+(?:near(?:\s+me|\s+my\s+location)?|nearby|around\s+(?:here|me)|here)\b/i,
  );
  if (needWantM) return needWantM[1].trim() || null;

  // ── Group 6: "looking / searching for X" ────────────────────────────────
  const lookingM = t.match(
    /\b(?:(?:i(?:'m|\s+am)\s+)?(?:looking|searching)\s+for)\s+(?:a\s+|an\s+|some\s+)?(.+?)\s+(?:near(?:\s+me|\s+my\s+location)?|nearby|around\s+(?:here|me)|here)\b/i,
  );
  if (lookingM) return lookingM[1].trim() || null;

  // ── Group 7: "any X around here / near me" ──────────────────────────────
  const anyNearM = t.match(
    /\bany\s+(.+?)\s+(?:around\s+(?:here|me)|near(?:\s+me)?|nearby)\b/i,
  );
  if (anyNearM) return anyNearM[1].trim() || null;

  // "X around here / around me / around this area"
  const aroundHereM = t.match(
    /\b(.+?)\s+around\s+(?:here|me|this\s+(?:area|place))\b/i,
  );
  if (aroundHereM) {
    const candidate = aroundHereM[1]
      .trim()
      .replace(/^(?:find|show|give|get|bring|take)\s+(?:me\s+)?/i, "")
      .replace(/^(?:any|some|the|a|an|are\s+there|is\s+there)\s+/i, "");
    if (
      candidate &&
      candidate.split(/\s+/).length <= 4 &&
      !/^(what|where|how|who|when|i|we|they|find|show|give|get|bring|take)\b/i.test(
        candidate,
      )
    )
      return candidate;
  }

  // ── Group 8: activity intent ("somewhere to eat") ───────────────────────
  const somewhereM = t.match(
    /\b(?:somewhere|(?:a|good|nice|decent)\s+place)\s+to\s+(eat|drink|stay|sleep|shop|park|relax|chill|refuel|charge|rest|hang\s+out)\b/i,
  );
  if (somewhereM)
    return ACTIVITY_TO_CATEGORY[somewhereM[1].toLowerCase()] ?? somewhereM[1];

  // ── Group 9: "suggest / recommend X" ────────────────────────────────────
  const suggestM = t.match(
    /\b(?:suggest|recommend)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+)?(.+?)(?:\s+(?:near(?:\s+me)?|nearby|around\s+here|here)|\s*$)/i,
  );
  if (suggestM) {
    const candidate = suggestM[1].trim();
    if (
      candidate &&
      candidate.split(/\s+/).length <= 4 &&
      !/^(?:route|direction|way|path|place\s+to\s+go)\b/i.test(candidate)
    )
      return candidate;
  }

  return null;
}

const LANG_NAMES: Record<string, string> = {
  "en-US": "English",
  "en-GB": "English (UK)",
  "en-AU": "English (AU)",
  "en-IN": "English (IN)",
  "en-SG": "English (SG)",
  "en-NZ": "English (NZ)",
  "en-ZA": "English (ZA)",
  "en-IE": "English (IE)",
  "fr-FR": "French",
  "fr-CA": "French (CA)",
  "fr-BE": "French (BE)",
  "de-DE": "German",
  "de-AT": "German (AT)",
  "de-CH": "German (CH)",
  "es-ES": "Spanish",
  "es-MX": "Spanish (MX)",
  "es-US": "Spanish (US)",
  "it-IT": "Italian",
  "pt-BR": "Portuguese (BR)",
  "pt-PT": "Portuguese (PT)",
  "nl-NL": "Dutch",
  "nl-BE": "Dutch (BE)",
  "pl-PL": "Polish",
  "ru-RU": "Russian",
  "sv-SE": "Swedish",
  "da-DK": "Danish",
  "nb-NO": "Norwegian",
  "fi-FI": "Finnish",
  "cs-CZ": "Czech",
  "ro-RO": "Romanian",
  "tr-TR": "Turkish",
  "ca-ES": "Catalan",
  "cy-GB": "Welsh",
  "is-IS": "Icelandic",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "cmn-CN": "Chinese (Mandarin)",
  "yue-CN": "Chinese (Cantonese)",
  "hi-IN": "Hindi",
  arb: "Arabic",
  "ar-AE": "Arabic (Gulf)",
};

/** Returns a ChatWonder language directive, e.g. "Respond in French. " */
export function buildLangDirective(lang: string): string {
  return `Respond in ${LANG_NAMES[lang] ?? "English"}. `;
}

/** Embeds map context into a chat-wonder input string. */
export function buildMapInput(
  transcript: string,
  loc: { lat: number; lng: number } | null | undefined,
  dest:
    | { name?: string; address?: string; lat: number; lng: number }
    | null
    | undefined,
  routeActive: boolean,
  pendingEvents?: Array<{ eventName: string; timeLabel: string }>,
  prefix: string = "[stylist]",
  lang?: string,
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
  const langDirective = lang
    ? `Respond in ${LANG_NAMES[lang] ?? "English"}. `
    : "";

  return `${prefix}${ctx} ${langDirective}${transcript}`;
}
