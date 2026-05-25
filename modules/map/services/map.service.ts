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
  getHomeLocation: async (): Promise<{ homeLocation: { lat: number; lng: number } }> => {
    const res = await api.get<{ homeLocation: { lat: number; lng: number } }>("/api/mirror/map/home-location");
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

  voice: async (
    pcmBuffer: ArrayBuffer,
    ctx?: {
      lat?: number;
      lng?: number;
      traffic?: boolean;
      navigating?: boolean;
      profile?: string;
      remainingDistance?: number;
      remainingDuration?: number;
      destinationName?: string;
      currentInstruction?: string;
      nextManeuverDistance?: number;
      nextInstruction?: string;
      currentTime?: string;
      currentDate?: string;
      schedules?: string;
      currentPage?: string;
      userOutlineId?: string;
    },
    history?: Array<{ user: string; assistant: string }>,
    sampleRate?: number,
  ): Promise<{
    audio: ArrayBuffer;
    transcript: string;
    reply: string;
    action: ChatWonderAction | null;
    events: unknown[];
  }> => {
    const params: Record<string, string> = {};
    if (ctx?.lat !== undefined) params.lat = String(ctx.lat);
    if (ctx?.lng !== undefined) params.lng = String(ctx.lng);
    if (ctx?.traffic !== undefined) params.traffic = String(ctx.traffic);
    if (ctx?.navigating !== undefined) params.navigating = String(ctx.navigating);
    if (ctx?.profile) params.profile = ctx.profile;
    if (ctx?.remainingDistance !== undefined)
      params.remainingDistance = String(ctx.remainingDistance);
    if (ctx?.remainingDuration !== undefined)
      params.remainingDuration = String(ctx.remainingDuration);
    if (ctx?.destinationName)
      params.destinationName = encodeURIComponent(ctx.destinationName);
    if (ctx?.currentInstruction)
      params.currentInstruction = encodeURIComponent(ctx.currentInstruction);
    if (ctx?.nextManeuverDistance !== undefined)
      params.nextManeuverDistance = String(ctx.nextManeuverDistance);
    if (ctx?.nextInstruction)
      params.nextInstruction = encodeURIComponent(ctx.nextInstruction);
    if (ctx?.currentTime)
      params.currentTime = encodeURIComponent(ctx.currentTime);
    if (ctx?.currentDate)
      params.currentDate = encodeURIComponent(ctx.currentDate);
    if (ctx?.schedules)
      params.schedules = encodeURIComponent(ctx.schedules);
    if (ctx?.currentPage)
      params.currentPage = encodeURIComponent(ctx.currentPage);
    if (ctx?.userOutlineId) params.userOutlineId = ctx.userOutlineId;
    if (history?.length) params.history = JSON.stringify(history.slice(-4));
    if (sampleRate) params.sampleRate = String(sampleRate);

    const res = await api.axiosInstance.post(
      "/api/mirror/voice/process",
      pcmBuffer,
      {
        headers: { "Content-Type": "application/octet-stream" },
        responseType: "arraybuffer",
        params,
      },
    );

    const audio = res.data as ArrayBuffer;
    const transcript = decodeURIComponent(res.headers["x-transcript"] ?? "");
    const reply = decodeURIComponent(res.headers["x-reply"] ?? "");

    let action: ChatWonderAction | null = null;
    try {
      const raw = res.headers["x-action"];
      if (raw) action = JSON.parse(decodeURIComponent(raw)) as ChatWonderAction;
    } catch {
      /* malformed action — ignore */
    }

    let events: unknown[] = [];
    try {
      const rawEvents = res.headers["x-events"];
      if (rawEvents) events = JSON.parse(decodeURIComponent(rawEvents));
    } catch {
      /* ignore */
    }

    return { audio, transcript, reply, action, events };
  },
};
