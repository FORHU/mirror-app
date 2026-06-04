"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";
import { stopColor } from "../constants/stopColors";
import type { NearbyPOI } from "../services/map.service";

function walkingMin(distKm: number) {
  return Math.max(1, Math.round((distKm * 60) / 5));
}
function carMin(distKm: number) {
  return Math.max(1, Math.round((distKm * 60) / 30));
}

const ItineraryPOIMarkers: React.FC<{ map: mapboxgl.Map }> = ({ map }) => {
  const itineraryStopPOIs = useMapStore((s) => s.itineraryStopPOIs);
  const itineraryStops = useMapStore((s) => s.itineraryStops);
  const setSelectedPOI = useMapStore((s) => s.setSelectedPOI);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!map || itineraryStopPOIs.length === 0) return;

    itineraryStopPOIs.forEach(({ stopIndex, pois }) => {
      const color = stopColor(stopIndex);
      const stop = itineraryStops[stopIndex];

      pois.forEach((poi: NearbyPOI) => {
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="
            width:20px;height:20px;border-radius:50%;
            background:${color};border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.5);
            cursor:pointer;
          " title="${poi.name}"></div>
        `;
        el.style.willChange = "transform";

        el.addEventListener("click", () => {
          const dist = poi.distance ?? 0;
          setSelectedPOI({
            name: poi.name,
            category: poi.category,
            address: poi.address,
            distance: dist * 1000, // store expects metres for display logic
            location: { lat: poi.lat, lng: poi.lng },
            placeId: poi.placeId,
            photo: poi.photo ?? null,
            travelFromStop: stop
              ? { walkingMin: walkingMin(dist), carMin: carMin(dist) }
              : undefined,
          });
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([poi.lng, poi.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, itineraryStopPOIs, itineraryStops, setSelectedPOI]);

  return null;
};

export default ItineraryPOIMarkers;
