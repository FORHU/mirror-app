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
  search: async (query: string, proximity?: [number, number] | null): Promise<GeocodingFeature[]> => {
    if (!query) return [];
    
    const params: any = { q: query };
    if (proximity) {
      params.proximity = proximity.join(",");
    }
    
    const response = await api.get<GeocodingResponse>(
      "/mirror/map/search",
      params
    );
    
    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    return [];
  },

  getDirections: async (origin: [number, number], destination: [number, number], profile: string = "driving"): Promise<any | null> => {
    try {
      const response = await api.get<any>("/mirror/map/directions", {
        origin: origin.join(","),
        destination: destination.join(","),
        profile,
      });

    if (response.ok && response.data?.success) {
      return response.data.data;
    }
    return null;
    } catch (e) {
      return null;
    }
  }
};
