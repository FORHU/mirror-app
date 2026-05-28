"use client";

import React, { useEffect, useCallback, useState } from "react";
import { MapDashboard } from "@/modules/map";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { mapService } from "@/modules/map/services/map.service";
import { Loader2, ArrowLeft } from "lucide-react";
// import HomeLocationSetup from "@/modules/map/components/HomeLocationSetup";
import { useRouter } from "next/navigation";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";
import WeatherWidget from "@/components/WeatherWidget";

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
  const router = useRouter();
  const {
    homeLocation,
    homeLocationStatus,
    loadHomeLocation,
    isNavigating,
    clearNavigation,
  } = useMapStore();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString([], { weekday: "long" });
  const date = now.toLocaleDateString([], { month: "long", day: "numeric" });

  const onAction = useCallback(
    (action: ChatWonderAction) => {
      if (action.type === "maps_clear") clearNavigation();
    },
    [clearNavigation],
  );

  useVoice(
    {
      route: "/map",
      pageName: "Map",
      activeStep: isNavigating ? "navigating" : "exploring",
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
  }, [homeLocationStatus, homeLocation]);

  if (homeLocationStatus === "idle" || homeLocationStatus === "loading") {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white opacity-50 animate-spin" />
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
      {/* Header — weather left, time center, back right */}
      <header
        className="absolute top-0 inset-x-0 z-50 flex items-center shrink-0 py-4 px-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <div style={{ flex: "0 0 25%", display: "flex", alignItems: "center" }}>
          <WeatherWidget iconSize={32} />
        </div>
        <div
          style={{
            flex: "0 0 50%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            className="text-white font-thin select-none"
            style={{ fontSize: "2rem", lineHeight: 1 }}
          >
            {time}
          </span>
          <span className="text-white/60 text-sm font-light select-none">
            {day}, {date}
          </span>
        </div>
        <div
          style={{
            flex: "0 0 25%",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => router.back()}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
      </header>

      <MapDashboard />
    </main>
  );
}
