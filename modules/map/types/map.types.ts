export type TransportProfile = "car" | "bicycle" | "walking";

export interface DirectionsResponse {
  geojson: GeoJSON.FeatureCollection;
  steps: RouteStep[];
  distance: number;
  duration: number;
  profile: TransportProfile;
}

export interface RouteStep {
  instruction: string;
  maneuver: { type: string; modifier: string };
  distance: number;
  duration: number;
  name: string;
}
