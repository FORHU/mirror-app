"use client";

import React, { createContext, useContext, useRef, useState } from "react";
import type { Map } from "mapbox-gl";

interface MapContextType {
  map: Map | null;
  setMap: (map: Map | null) => void;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [map, setMap] = useState<Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  return (
    <MapContext.Provider value={{ map, setMap, mapContainerRef }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};
