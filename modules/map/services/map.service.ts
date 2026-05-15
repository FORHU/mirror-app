import { API_URL } from "@/modules/shared/config/device.config";

export interface GeocodeResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

export interface DirectionsFormatted {
  geojson: any;
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
  getHomeLocation: async () => {
    const response = await fetch(`${API_URL}/api/mirror/map/home-location`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`, // Placeholder for auth
      },
    });
    if (!response.ok) throw new Error('Failed to fetch home location');
    return response.json();
  },

  setHomeLocation: async (coords: { lat: number; lng: number }) => {
    const response = await fetch(`${API_URL}/api/mirror/map/home-location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(coords),
    });
    if (!response.ok) throw new Error('Failed to save home location');
    return response.json();
  },

  geocode: async (query: string, userLocation?: { lat: number; lng: number }): Promise<{ results: GeocodeResult[] }> => {
    const body: Record<string, any> = { query };
    if (userLocation) {
      body.lat = userLocation.lat;
      body.lng = userLocation.lng;
    }
    const response = await fetch(`${API_URL}/api/mirror/map/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Geocoding failed');
    return response.json();
  },

  directions: async (origin: [number, number], destination: [number, number], profile: 'car' | 'motorcycle' | 'bicycle' | 'walking' = "car"): Promise<DirectionsFormatted> => {
    const response = await fetch(`${API_URL}/api/mirror/map/directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ origin, destination, profile }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Directions failed');
    }

    return response.json();
  },

  voice: async (
    pcmBuffer: ArrayBuffer,
    ctx?: { lat?: number; lng?: number; traffic?: boolean; navigating?: boolean; profile?: string; remainingDistance?: number; remainingDuration?: number; destinationName?: string },
    history?: Array<{ user: string; assistant: string }>,
  ): Promise<{
    audio: ArrayBuffer;
    transcript: string;
    reply: string;
    intent: string;
    destination: string;
    profile: string;
  }> => {
    const params = new URLSearchParams();
    if (ctx?.lat               !== undefined) params.set("lat",               String(ctx.lat));
    if (ctx?.lng               !== undefined) params.set("lng",               String(ctx.lng));
    if (ctx?.traffic           !== undefined) params.set("traffic",           String(ctx.traffic));
    if (ctx?.navigating        !== undefined) params.set("navigating",        String(ctx.navigating));
    if (ctx?.profile)                         params.set("profile",           ctx.profile);
    if (ctx?.remainingDistance !== undefined) params.set("remainingDistance", String(ctx.remainingDistance));
    if (ctx?.remainingDuration !== undefined) params.set("remainingDuration", String(ctx.remainingDuration));
    if (ctx?.destinationName)                 params.set("destinationName",   encodeURIComponent(ctx.destinationName));
    if (history?.length)                      params.set("history",           JSON.stringify(history.slice(-4)));

    const url = `${API_URL}/api/mirror/voice/process?${params}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pcmBuffer,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Voice processing failed' }));
      throw new Error(err.error ?? 'Voice processing failed');
    }
    const audio       = await response.arrayBuffer();
    const transcript  = decodeURIComponent(response.headers.get('X-Transcript')  ?? '');
    const reply       = decodeURIComponent(response.headers.get('X-Reply')        ?? '');
    const intent      = response.headers.get('X-Intent') ?? 'other';
    const destination = decodeURIComponent(response.headers.get('X-Destination') ?? '');
    const profile     = decodeURIComponent(response.headers.get('X-Profile')     ?? '');
    return { audio, transcript, reply, intent, destination, profile };
  },
};
