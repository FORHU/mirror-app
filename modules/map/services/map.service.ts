import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { api } from "@/modules/shared/api/api-client";

export interface NearbyPOI {
  placeId: string;
  name: string;
  category: string;
  categoryIcon: string;
  lat: number;
  lng: number;
  address: string;
  distance: number;
  photo: string | null;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  openNow?: boolean;
  weekdayDescriptions?: string[];
  phone?: string;
  website?: string;
}

export interface GeocodeResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  placeType: string;
}

export interface DirectionsFormatted {
  geojson: GeoJSON.FeatureCollection;
  steps: Array<{
    instruction: string;
    maneuver: { type: string; modifier: string };
    distance: number;
    duration: number;
    name: string;
  }>;
  distance: number;
  duration: number;
}

export const mapService = {
  getHomeLocation: async (): Promise<{
    homeLocation: { lat: number; lng: number };
  }> => {
    const res = await api.get<{ homeLocation: { lat: number; lng: number } }>(
      "/api/mirror/map/home-location",
    );
    if (!res.ok) throw new Error("Failed to fetch home location");
    return res.data as { homeLocation: { lat: number; lng: number } };
  },

  setHomeLocation: async (coords: { lat: number; lng: number }) => {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      token =
        window.location.hostname === process.env.NEXT_PUBLIC_DOMAIN2
          ? (process.env.NEXT_PUBLIC_USER2_ACCESS_TOKEN ?? null)
          : (process.env.NEXT_PUBLIC_USER1_ACCESS_TOKEN ?? null);
      if (!token) {
        token = sessionStorage.getItem("access_token");
      }
    }
    const res = await fetch("/api/mirror/map/home-location", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-platform": "kiosk",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(coords),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[setHomeLocation] failed:", res.status, data);
      throw new Error(`Failed to save home location: ${res.status}`);
    }
    return res.json();
  },

  geocode: async (
    query: string,
    userLocation?: { lat: number; lng: number },
  ): Promise<{ results: GeocodeResult[] }> => {
    const body: Record<string, string | number> = { query };
    if (userLocation) {
      body.lat = userLocation.lat;
      body.lng = userLocation.lng;
    }
    const res = await api.post<{ results: GeocodeResult[] }>(
      "/api/mirror/map/geocode",
      body,
    );
    if (!res.ok) throw new Error("Geocoding failed");
    return res.data!;
  },

  directions: async (
    origin: [number, number],
    destination: [number, number],
    profile: "car" | "motorcycle" | "bicycle" | "walking" = "car",
  ): Promise<DirectionsFormatted> => {
    const res = await api.post<DirectionsFormatted>(
      "/api/mirror/map/directions",
      { origin, destination, profile },
    );
    if (!res.ok) {
      const err = res.data as unknown as { error?: string };
      throw new Error(err?.error ?? "Directions failed");
    }
    return res.data!;
  },

  nearbyPOIs: async (
    lat: number,
    lng: number,
    radiusM = 1000,
    category?: string,
  ): Promise<{ pois: NearbyPOI[] }> => {
    const params: Record<string, unknown> = { lat, lng, radius: radiusM };
    if (category) params.category = category;
    const res = await api.get<{ pois: NearbyPOI[] }>(
      "/api/mirror/map/nearby-pois",
      params,
    );
    if (!res.ok) throw new Error("Nearby POIs fetch failed");
    return res.data!;
  },

  venuePhotos: async (placeId: string): Promise<{ photos: string[] }> => {
    const res = await api.get<{ photos: string[] }>(
      `/api/mirror/map/venue-photos/${encodeURIComponent(placeId)}`,
    );
    if (!res.ok) throw new Error("Venue photos fetch failed");
    return res.data!;
  },

  tts: async (text: string): Promise<ArrayBuffer> => {
    const res = await api.axiosInstance.post(
      "/api/mirror/voice/tts",
      { text },
      { responseType: "arraybuffer", timeout: 60000 },
    );
    return res.data as ArrayBuffer;
  },

  transcribe: async (
    pcmBuffer: ArrayBuffer,
    language: string = "en-US",
  ): Promise<string> => {
    const res = await api.axiosInstance.post(
      `/api/mirror/voice/transcribe?lang=${language}&provider=openai`,
      pcmBuffer,
      {
        headers: { "Content-Type": "application/octet-stream" },
        timeout: 60000,
      },
    );
    return res.data.transcript;
  },

  ask: async (
    transcript: string,
    ctx: Record<string, unknown>,
    language: string = "en-US",
  ): Promise<{
    audio: ArrayBuffer;
    reply: string;
    action: ChatWonderAction | null;
    events: unknown[];
    sessionId: string;
    intent?: { primary: string; secondary: string | null; confidence: number };
    emotion?: string;
    requiresConfirmation?: boolean;
    followUpQuestion?: string | null;
    suggestions?: string[];
    uiHints?: { overlay: string | null; focus: string | null };
    memoryUpdates?: Record<string, unknown>;
  }> => {
    const payload = { transcript, ctx };
    const res = await api.axiosInstance.post<{
      reply: string;
      action: ChatWonderAction | null;
      events: unknown[];
      sessionId: string;
      audioBase64: string;
      intent?: { primary: string; secondary: string | null; confidence: number };
      emotion?: string;
      requiresConfirmation?: boolean;
      followUpQuestion?: string | null;
      suggestions?: string[];
      uiHints?: { overlay: string | null; focus: string | null };
      memoryUpdates?: Record<string, unknown>;
    }>(`/api/mirror/voice/ask?lang=${language}`, payload);

    const {
      reply,
      action,
      events,
      sessionId,
      audioBase64,
      intent,
      emotion,
      requiresConfirmation,
      followUpQuestion,
      suggestions,
      uiHints,
      memoryUpdates,
    } = res.data;

    const binaryStr = atob(audioBase64 ?? "");
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++)
      bytes[i] = binaryStr.charCodeAt(i);
    const audio = bytes.buffer;

    return {
      audio,
      reply,
      action: action ?? null,
      events: events ?? [],
      sessionId: sessionId ?? "",
      intent,
      emotion,
      requiresConfirmation,
      followUpQuestion,
      suggestions,
      uiHints,
      memoryUpdates,
    };
  },
};
