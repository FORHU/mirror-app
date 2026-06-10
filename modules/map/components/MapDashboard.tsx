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
    setSelectedPOI,
    selectedPOI,
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
        pois={isPanning || selectedPOI ? [] : suggestedPOIs}
        label={suggestionLabel || undefined}
        chatVisible={chatVisible}
        onSelect={(poi) => {
          setSelectedPOI({
            name: poi.name,
            category: poi.category,
            address: poi.address,
            distance: poi.distance != null ? poi.distance * 1000 : undefined,
            location: { lat: poi.lat, lng: poi.lng },
            placeId: poi.placeId,
            photo: poi.photo,
          });
          // Don't call clearSuggestions here — the card strip hides automatically
          // when selectedPOI is set (see pois prop above), and the map pins stay
          // intact so the user can dismiss ExploreHUD and return to browsing.
        }}
      />
      <ItineraryPOIPanel />
    </div>
  );
}
