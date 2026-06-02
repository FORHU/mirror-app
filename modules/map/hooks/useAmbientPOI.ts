"use client";

export interface AmbientPOI {
  name: string;
  category: string;
  distanceM: number;
  lat: number;
  lng: number;
}

// Ambient POI announcements were tied to moving-user navigation, which has been
// removed. POI suggestions are now triggered via the POI prompt card in MapDashboard.
export function useAmbientPOI() {
  return { ambientPOI: null as AmbientPOI | null, dismissAmbientPOI: () => {} };
}
