export type TransportProfile = 'car' | 'motorcycle' | 'bicycle' | 'walking'

export interface DirectionsResponse {
  geojson: any; // Using any for GeoJSON.FeatureCollection to avoid dependency overhead if not present
  steps: RouteStep[]
  distance: number
  duration: number
  profile: TransportProfile
}

export interface RouteStep {
  instruction: string
  maneuver: { type: string; modifier: string }
  distance: number
  duration: number
  name: string
}
