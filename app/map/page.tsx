"use client";

import React, { useEffect, useCallback } from "react";
import { MapDashboard } from "@/modules/map";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { mapService } from "@/modules/map/services/map.service";
// import HomeLocationSetup from "@/modules/map/components/HomeLocationSetup";
import { useVoice } from "@/modules/shared/voice/useVoice";
import MirrorHeader from "@/components/MirrorHeader";
import { ChatNavLoader } from "@/components/ChatNavLoader";

async function consumePendingLocation() {
  try {
    const raw = sessionStorage.getItem("mirror_pending_map_location");
    if (!raw) return;
    sessionStorage.removeItem("mirror_pending_map_location");

    const { query, label } = JSON.parse(raw) as {
      query: string;
      label: string;
    };
    const store = useMapStore.getState();
    const userLoc = store.userLocation ?? store.homeLocation ?? undefined;
    const { results } = await mapService.geocode(query, userLoc);
    if (!results.length) return;

    useMapStore.setState({
      selectedDestination: { ...results[0], name: label || results[0].name },
      activeRoute: null,
      isSearching: false,
      searchResults: [],
    });
  } catch {}
}

async function consumePendingDirections() {
  try {
    const raw = sessionStorage.getItem("mirror_pending_map_directions");
    if (!raw) return;
    sessionStorage.removeItem("mirror_pending_map_directions");

    const { destination } = JSON.parse(raw) as { destination: string };
    const store = useMapStore.getState();
    const userLoc = store.userLocation ?? store.homeLocation ?? undefined;
    const { results } = await mapService.geocode(destination, userLoc);
    if (!results.length) return;

    await useMapStore.getState().setDestination(results[0]);
  } catch {}
}

export default function MapPage() {
  const {
    homeLocation,
    homeLocationStatus,
    loadHomeLocation,
    loadOutlineStops,
  } = useMapStore();
  const onAction = useCallback(() => {}, []);

  const { isListening } = useVoice(
    {
      route: "/map",
      pageName: "Map",
      activeStep: "exploring",
      mode: "map",
    },
    onAction,
  );

  useEffect(() => {
    loadHomeLocation();
  }, [loadHomeLocation]);

  useEffect(() => {
    if (homeLocationStatus !== "loaded" || homeLocation === null) return;
    consumePendingLocation();
    consumePendingDirections();
    loadOutlineStops();
  }, [homeLocationStatus, homeLocation, loadOutlineStops]);

  if (homeLocationStatus === "idle" || homeLocationStatus === "loading") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mb-6" />
        <p className="text-white/50 text-sm font-light tracking-wide">
          Setting up your map…
        </p>
      </div>
    );
  }

  // if (homeLocationStatus === "error") {
  //   return (
  //     <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white p-4">
  //       <p className="mb-4 text-white/70">Failed to load system state</p>
  //       <button
  //         onClick={() => loadHomeLocation()}
  //         className="px-6 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
  //       >
  //         Retry
  //       </button>
  //     </div>
  //   );
  // }

  // if (homeLocationStatus === "loaded" && homeLocation === null) {
  //   return <HomeLocationSetup />;
  // }

  return (
    <main className="w-screen h-dvh bg-black relative overflow-hidden">
      <ChatNavLoader />

      {/* Header — weather left, time center, back right */}
      <MirrorHeader className="absolute top-0 inset-x-0 z-50" isListening={isListening} />

      <MapDashboard />
    </main>
  );
}
