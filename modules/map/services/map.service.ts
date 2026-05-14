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
};
