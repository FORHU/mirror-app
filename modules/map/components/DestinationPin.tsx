"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface DestinationPinProps {
  map: mapboxgl.Map;
}

const DestinationPin: React.FC<DestinationPinProps> = ({ map }) => {
  const { selectedDestination } = useMapStore();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map || !selectedDestination) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const el = document.createElement("div");
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.55));">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1C7.716 1 1 7.716 1 16c0 11.25 15 25 15 25S31 27.25 31 16C31 7.716 24.284 1 16 1Z" fill="white" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
          <circle cx="16" cy="16" r="5" fill="#374151"/>
        </svg>
      </div>
    `;
    el.style.cursor = "pointer";

    markerRef.current?.remove();
    markerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([selectedDestination.lng, selectedDestination.lat])
      .addTo(map);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map, selectedDestination]);

  return null;
};

export default DestinationPin;
