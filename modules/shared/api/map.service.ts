import { api } from "@/modules/shared/api/api-client";

export interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number];
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  context: Array<{ id: string; text: string }>;
}

export interface GeocodingResponse {
  success: boolean;
  data: GeocodingFeature[];
}

export interface DirectionsResponse {
  success: boolean;
  data: {
    routes: Array<{
      geometry: string | any;
      duration: number;
      distance: number;
      legs: Array<{
        steps: Array<{
          instruction: string;
          maneuver: {
            type: string;
            instruction: string;
          };
        }>;
      }>;
    }>;
  };
}

export const mapService = {
  search: async (query: string): Promise<GeocodingFeature[]> => {
    if (!query) return [];
    
    const response = await api.get<GeocodingResponse>(
      "/mirror/map/search",
      { q: query }
    );
    
    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    return [];
  },

  getDirections: async (origin: [number, number], destination: [number, number]): Promise<DirectionsResponse["data"] | null> => {
    const response = await api.get<DirectionsResponse>(
      "/mirror/map/directions",
      { 
        origin: origin.join(","), 
        destination: destination.join(",") 
      }
    );

    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    return null;
  }
};
