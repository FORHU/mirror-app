"use client";

import React from "react";
import { MapProvider } from "./MapProvider";
import { MapViewport } from "./MapViewport";
import { useMapCamera } from "../hooks/useMapCamera";
import { RouteLayer } from "./RouteLayer";

const SceneLogic = () => {
  useMapCamera();
  return null;
};

export const MapScene: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <MapProvider>
      <div className={`relative w-full h-full overflow-hidden ${className || ""}`}>
        <MapViewport />
        <RouteLayer />
        <SceneLogic />
        {/* Overlay layer for glassmorphism UI */}
        <div className="relative z-10 pointer-events-none w-full h-full">
           {/* Future UI widgets go here */}
        </div>
      </div>
    </MapProvider>
  );
};
