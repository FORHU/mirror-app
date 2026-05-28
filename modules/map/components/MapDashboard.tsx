"use client";

import { useEffect } from "react";
import { useMapStore } from "../store/useMapStore";
import NavigationHUD from "./NavigationHUD";
import { ExploreHUD } from "./ExploreHUD";
import MapViewport from "./MapViewport";
import CommuteWidget from "./CommuteWidget";
import MapMicPill from "./MapMicPill";
import NavCard from "./NavCard";
import POIRecommendationStrip from "./POIRecommendationStrip";

export default function MapDashboard() {
  const { isNavigating, setUserLocation, fetchNearbyPOIs, homeLocation } = useMapStore();

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [setUserLocation]);

  // Fetch POIs around the user's location on mount
  useEffect(() => {
    const loc = useMapStore.getState().userLocation ?? homeLocation;
    if (loc) fetchNearbyPOIs(loc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Map — full screen, full opacity */}
      <div className="absolute inset-0">
        <MapViewport />
      </div>

      {/* Top-left: commute widget — explore mode only */}
      <div className="absolute top-24 left-6 z-40 pointer-events-auto">
        <CommuteWidget />
      </div>

      {isNavigating && <NavigationHUD />}
      <ExploreHUD />
      <POIRecommendationStrip />
      <NavCard />
      <MapMicPill />
    </div>
  );
}
