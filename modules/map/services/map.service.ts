import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { api } from "@/modules/shared/api/api-client";

export interface NearbyPOI {
  fsqId: string;
  name: string;
  category: string;
  categoryIcon: string;
  lat: number;
  lng: number;
  address: string;
  distance: number;
  photo: string | null;
}

export interface GeocodeResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
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
    const res = await api.patch("/api/mirror/map/home-location", coords);
    if (!res.ok) throw new Error("Failed to save home location");
    return res.data;
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
  ): Promise<{ pois: NearbyPOI[] }> => {
    const res = await api.get<{ pois: NearbyPOI[] }>(
      "/api/mirror/map/nearby-pois",
      { lat, lng, radius: radiusM },
    );
    if (!res.ok) throw new Error("Nearby POIs fetch failed");
    return res.data!;
  },

  venuePhotos: async (fsqId: string): Promise<{ photos: string[] }> => {
    const res = await api.get<{ photos: string[] }>(
      `/api/mirror/map/venue-photos/${encodeURIComponent(fsqId)}`,
    );
    if (!res.ok) throw new Error("Venue photos fetch failed");
    return res.data!;
  },

  tts: async (text: string): Promise<ArrayBuffer> => {
    const res = await api.axiosInstance.post(
      "/api/mirror/voice/tts",
      { text },
      { responseType: "arraybuffer" },
    );
    return res.data as ArrayBuffer;
  },

  transcribe: async (pcmBuffer: ArrayBuffer): Promise<string> => {
    const res = await api.axiosInstance.post(
      "/api/mirror/voice/transcribe",
      pcmBuffer,
      {
        headers: { "Content-Type": "application/octet-stream" },
      },
    );
    return res.data.transcript;
  },

  ask: async (
    transcript: string,
    ctx: Record<string, unknown>,
  ): Promise<{
    audio: ArrayBuffer;
    reply: string;
    action: ChatWonderAction | null;
    events: unknown[];
    sessionId: string;
    // Cognitive orchestration fields
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
      intent?: {
        primary: string;
        secondary: string | null;
        confidence: number;
      };
      emotion?: string;
      requiresConfirmation?: boolean;
      followUpQuestion?: string | null;
      suggestions?: string[];
      uiHints?: { overlay: string | null; focus: string | null };
      memoryUpdates?: Record<string, unknown>;
    }>("/api/mirror/voice/ask", payload);

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

    // Decode base64 audio string → ArrayBuffer
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
