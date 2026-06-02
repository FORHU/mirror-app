"use client";

import React from "react";
import { useMapStore } from "../store/useMapStore";
import { Map as MapIcon, Maximize2 } from "lucide-react";

const OverviewToggle = () => {
  const { cameraMode, setCameraMode, activeRoute } = useMapStore();

  if (!activeRoute) return null;

  const isOverview = cameraMode === "overview";

  return (
    <button
      onClick={() => setCameraMode(isOverview ? "free" : "overview")}
      className="pointer-events-auto flex items-center justify-center w-14 h-14 rounded-full border border-white/20 bg-black/20 backdrop-blur-md hover:bg-white/10 transition-colors"
    >
      {isOverview ? (
        <Maximize2 className="w-6 h-6 text-white/80" />
      ) : (
        <MapIcon className="w-6 h-6 text-white/80" />
      )}
    </button>
  );
};

export default OverviewToggle;
