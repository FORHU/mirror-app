"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import { ExploreHUD } from "./ExploreHUD";
import dynamic from "next/dynamic";
const MapViewport = dynamic(() => import("./MapViewport"), { ssr: false });
import SuggestedPOIMarkers from "./SuggestedPOIMarkers";
import POICurationStack from "./POICurationStack";
import RoutePreviewCard from "./RoutePreviewCard";
import ItineraryPOIPanel from "./ItineraryPOIPanel";

export default function MapDashboard() {
  const {
    setUserLocation,
    saveHomeLocation,
    homeLocation,
    suggestedPOIs,
    suggestionLabel,
    setDestination,
    clearSuggestions,
    isPanning,
  } = useMapStore();
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
        if (!hasSavedHomeRef.current && homeLocation === null) {
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

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Map — full screen */}
      <div className="absolute inset-0">
        <MapViewport />
      </div>

      <RoutePreviewCard />

      <ExploreHUD />
      <SuggestedPOIMarkers />
      <POICurationStack
        pois={isPanning ? [] : suggestedPOIs}
        label={suggestionLabel || undefined}
        chatVisible={chatVisible}
        onSelect={(poi) => {
          setDestination({
            name: poi.name,
            lat: poi.lat,
            lng: poi.lng,
            address: poi.address,
            placeId: poi.placeId,
          });
          clearSuggestions();
        }}
      />
      <ItineraryPOIPanel />
    </div>
  );
}
