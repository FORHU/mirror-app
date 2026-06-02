"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ExploreHUD } from "./ExploreHUD";
import MapViewport from "./MapViewport";
import MapMicPill from "./MapMicPill";
import SuggestedPOIMarkers from "./SuggestedPOIMarkers";
import RoutePreviewCard from "./RoutePreviewCard";
import WeatherWidget from "./WeatherWidget";

export default function MapDashboard() {
  const { setUserLocation, saveHomeLocation, homeLocationStatus } =
    useMapStore();
  const { transcriptOpen, transcript, reply, error } = useVoiceContext();
  const chatVisible = transcriptOpen && !!(transcript || reply || error);

  const hasSavedHomeRef = useRef(false);

  // Geolocation watch — auto-saves first fix as homeLocation
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude };
        setUserLocation(loc);
        if (!hasSavedHomeRef.current && homeLocationStatus !== "loaded") {
          hasSavedHomeRef.current = true;
          saveHomeLocation(loc);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WeatherWidget location: destination when route active, mirror location otherwise
  const selectedDest = useMapStore((s) => s.selectedDestination);
  const homeLocation = useMapStore((s) => s.homeLocation);
  const weatherLocation = selectedDest ?? homeLocation;

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Map — full screen */}
      <div className="absolute inset-0">
        <MapViewport />
      </div>

      {/* Top-left: weather */}
      <div className="absolute top-6 left-6 z-40 pointer-events-none">
        <WeatherWidget location={weatherLocation} />
      </div>

      {/* Bottom-left: route card — slides up when chat bubble is open */}
      <div
        className="absolute left-6 z-40 pointer-events-none"
        style={{
          bottom: chatVisible ? "13rem" : "7rem",
          transition: "bottom 0.25s ease",
        }}
      >
        <RoutePreviewCard />
      </div>

      <ExploreHUD />
      <SuggestedPOIMarkers />
      <MapMicPill />
    </div>
  );
}
