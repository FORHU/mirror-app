"use client";

import React, { useEffect } from "react";
import { useMapStore } from "../store/useMapStore";
import NavigationHUD from "./NavigationHUD";
import WeatherWidget from "./WeatherWidget";
import OverviewToggle from "./OverviewToggle";
import { ExploreHUD } from "./ExploreHUD";
import MapViewport from "./MapViewport";
import MapSearch from "./MapSearch";

export default function MapDashboard() {
  const { isNavigating } = useMapStore();

  return (
    <div className="relative w-full h-dvh bg-black overflow-hidden">
      <MapViewport />
      
      {isNavigating && (
        <>
          <NavigationHUD />
          <div className="absolute bottom-10 right-10 pointer-events-auto">
            <OverviewToggle />
          </div>
        </>
      )}

      {!isNavigating && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <MapSearch />
        </div>
      )}

      <ExploreHUD />
    </div>
  );
}
