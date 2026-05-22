import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import { ACCESS_TOKEN } from "@/modules/shared/constants/storage-keys";

export interface GeocodeResult {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface DirectionsFormatted {
  geojson: GeoJSON.FeatureCollection;
  steps: Array<{
    instruction: string;
    maneuver: { type: string; modifier: string; bearing_after?: number };
    distance: number;
    duration: number;
    name: string;
  }>;
  distance: number;
  duration: number;
}

export const mapService = {
  getHomeLocation: async () => {
    const response = await fetch(`/api/mirror/map/home-location`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch home location');
    return response.json();
  },

  setHomeLocation: async (coords: { lat: number; lng: number }) => {
    const response = await fetch(`/api/mirror/map/home-location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`,
      },
      body: JSON.stringify(coords),
    });
    if (!response.ok) throw new Error('Failed to save home location');
    return response.json();
  },

  geocode: async (query: string, userLocation?: { lat: number; lng: number }): Promise<{ results: GeocodeResult[] }> => {
    const body: Record<string, string | number> = { query };
    if (userLocation) {
      body.lat = userLocation.lat;
      body.lng = userLocation.lng;
    }
    const response = await fetch(`/api/mirror/map/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Geocoding failed');
    return response.json();
  },

  directions: async (origin: [number, number], destination: [number, number], profile: 'car' | 'motorcycle' | 'bicycle' | 'walking' = "car"): Promise<DirectionsFormatted> => {
    const response = await fetch(`/api/mirror/map/directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN)}`,
      },
      body: JSON.stringify({ origin, destination, profile }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Directions failed');
    }

    return response.json();
  },

  tts: async (text: string): Promise<ArrayBuffer> => {
    const response = await fetch(`/api/mirror/voice/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error('TTS failed');
    return response.arrayBuffer();
  },

  voice: async (
    pcmBuffer: ArrayBuffer,
    ctx?: { lat?: number; lng?: number; traffic?: boolean; navigating?: boolean; profile?: string; remainingDistance?: number; remainingDuration?: number; destinationName?: string; currentInstruction?: string; nextManeuverDistance?: number; nextInstruction?: string; currentTime?: string; currentDate?: string; schedules?: string; currentPage?: string; userOutlineId?: string },
    history?: Array<{ user: string; assistant: string }>,
    sampleRate?: number,
  ): Promise<{
    audio: ArrayBuffer;
    transcript: string;
    reply: string;
    action: ChatWonderAction | null;
  }> => {
    const params = new URLSearchParams();
    if (ctx?.lat               !== undefined) params.set("lat",               String(ctx.lat));
    if (ctx?.lng               !== undefined) params.set("lng",               String(ctx.lng));
    if (ctx?.traffic           !== undefined) params.set("traffic",           String(ctx.traffic));
    if (ctx?.navigating        !== undefined) params.set("navigating",        String(ctx.navigating));
    if (ctx?.profile)                         params.set("profile",           ctx.profile);
    if (ctx?.remainingDistance !== undefined) params.set("remainingDistance", String(ctx.remainingDistance));
    if (ctx?.remainingDuration !== undefined) params.set("remainingDuration", String(ctx.remainingDuration));
    if (ctx?.destinationName)                   params.set("destinationName",       encodeURIComponent(ctx.destinationName));
    if (ctx?.currentInstruction)                params.set("currentInstruction",    encodeURIComponent(ctx.currentInstruction));
    if (ctx?.nextManeuverDistance !== undefined) params.set("nextManeuverDistance",  String(ctx.nextManeuverDistance));
    if (ctx?.nextInstruction)                   params.set("nextInstruction",       encodeURIComponent(ctx.nextInstruction));
    if (ctx?.currentTime)                       params.set("currentTime",           encodeURIComponent(ctx.currentTime));
    if (ctx?.currentDate)                       params.set("currentDate",           encodeURIComponent(ctx.currentDate));
    if (ctx?.schedules)                         params.set("schedules",             encodeURIComponent(ctx.schedules));
    if (ctx?.currentPage)                       params.set("currentPage",           encodeURIComponent(ctx.currentPage));
    if (ctx?.userOutlineId)                     params.set("userOutlineId",         ctx.userOutlineId);
    if (history?.length)                        params.set("history",               JSON.stringify(history.slice(-4)));
    if (sampleRate)                             params.set("sampleRate",            String(sampleRate));

    const url = `/api/mirror/voice/process?${params}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pcmBuffer,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Voice processing failed' }));
      throw new Error(err.error ?? 'Voice processing failed');
    }
    const audio      = await response.arrayBuffer();
    const transcript = decodeURIComponent(response.headers.get('X-Transcript') ?? '');
    const reply      = decodeURIComponent(response.headers.get('X-Reply')      ?? '');
    let action: ChatWonderAction | null = null;
    try {
      const raw = response.headers.get('X-Action');
      if (raw) action = JSON.parse(decodeURIComponent(raw)) as ChatWonderAction;
    } catch { /* malformed action — ignore */ }
    return { audio, transcript, reply, action };
  },
};
