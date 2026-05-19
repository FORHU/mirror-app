"use client";

import React, { useEffect } from "react";
import { MapDashboard } from "@/modules/map";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { mapService } from "@/modules/map/services/map.service";
import { Loader2 } from "lucide-react";
import HomeLocationSetup from "@/modules/map/components/HomeLocationSetup";

async function consumePendingLocation() {
  try {
    const raw = localStorage.getItem("mirror_pending_map_location");
    if (!raw) return;
    localStorage.removeItem("mirror_pending_map_location");

    const { query, label } = JSON.parse(raw) as { query: string; label: string };
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
    const raw = localStorage.getItem("mirror_pending_map_directions");
    if (!raw) return;
    localStorage.removeItem("mirror_pending_map_directions");

    const { destination } = JSON.parse(raw) as { destination: string };
    const store = useMapStore.getState();
    const userLoc = store.userLocation ?? store.homeLocation ?? undefined;
    const { results } = await mapService.geocode(destination, userLoc);
    if (!results.length) return;

    useMapStore.setState({
      selectedDestination: results[0],
      activeRoute: null,
      isSearching: false,
      searchResults: [],
    });
    await useMapStore.getState().fetchRoute();
    useMapStore.getState().startNavigation();
  } catch {}
}

export default function MapPage() {
  const {
    homeLocation,
    homeLocationStatus,
    loadHomeLocation
  } = useMapStore();

  useEffect(() => {
    loadHomeLocation();
  }, [loadHomeLocation]);

  useEffect(() => {
    if (homeLocationStatus !== "loaded" || homeLocation === null) return;
    consumePendingLocation();
    consumePendingDirections();
  }, [homeLocationStatus, homeLocation]);

  if (homeLocationStatus === 'idle' || homeLocationStatus === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white opacity-50 animate-spin" />
      </div>
    );
  }

  if (homeLocationStatus === 'error') {
    return (
      <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white p-4">
        <p className="mb-4 text-white/70">Failed to load system state</p>
        <button 
          onClick={() => loadHomeLocation()}
          className="px-6 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (homeLocationStatus === 'loaded' && homeLocation === null) {
    return <HomeLocationSetup />;
  }

  return (
    <main className="w-screen h-dvh bg-black relative overflow-hidden">
      <MapDashboard />
    </main>
  );
}
