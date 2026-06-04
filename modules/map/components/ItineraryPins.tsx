"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";
import { stopColor } from "../constants/stopColors";

const ItineraryPins: React.FC<{ map: mapboxgl.Map }> = ({ map }) => {
  const itineraryStops = useMapStore((s) => s.itineraryStops);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!map || itineraryStops.length === 0) return;

    itineraryStops.forEach((stop, i) => {
      const color = stopColor(i);
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.55));">
          <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 1C7.716 1 1 7.716 1 16c0 11.25 15 25 15 25S31 27.25 31 16C31 7.716 24.284 1 16 1Z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
            <text x="16" y="20" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="12" font-weight="700" font-family="system-ui">${i + 1}</text>
          </svg>
        </div>
      `;
      el.style.willChange = "transform";

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, itineraryStops]);

  return null;
};

export default ItineraryPins;
