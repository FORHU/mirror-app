"use client";

import React from "react";
import { useMapStore } from "../store/useMapStore";
import { Navigation, Map as MapIcon } from "lucide-react";

const OverviewToggle = () => {
  const { cameraMode, setCameraMode, isNavigating } = useMapStore();

  if (!isNavigating) return null;

  const isFollow = cameraMode === 'follow';

  return (
    <button
      onClick={() => setCameraMode(isFollow ? 'overview' : 'follow')}
      className="pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full border border-white/20 bg-black/20 backdrop-blur-md hover:bg-white/10 transition-colors"
    >
      {isFollow ? (
        <MapIcon className="w-6 h-6 text-white/80" />
      ) : (
        <Navigation className="w-6 h-6 text-white/80" />
      )}
    </button>
  );
};

export default OverviewToggle;
