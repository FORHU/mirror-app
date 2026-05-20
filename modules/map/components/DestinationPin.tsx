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
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 0 6px #00eeff) drop-shadow(0 0 14px rgba(0,238,255,0.7));">
        <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 0C8.059 0 0 8.059 0 18c0 12.75 18 30 18 30S36 30.75 36 18C36 8.059 27.941 0 18 0Z" fill="#00eeff"/>
          <circle cx="18" cy="18" r="7" fill="white" opacity="1"/>
          <circle cx="18" cy="18" r="3.5" fill="#00eeff"/>
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
