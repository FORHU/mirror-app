"use client";

import React from "react";
import { MapProvider } from "./MapProvider";
import MapViewport from "./MapViewport";

// MapViewport renders RouteLayer, UserPuck, and manages useMapCamera internally.
export const MapScene: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <MapProvider>
      <div
        className={`relative w-full h-full overflow-hidden ${className || ""}`}
      >
        <MapViewport />
        {/* Overlay layer for glassmorphism UI */}
        <div className="relative z-10 pointer-events-none w-full h-full">
          {/* Future UI widgets go here */}
        </div>
      </div>
    </MapProvider>
  );
};
