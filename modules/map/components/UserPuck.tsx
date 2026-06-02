"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface UserPuckProps {
  map: mapboxgl.Map;
}

const UserPuck: React.FC<UserPuckProps> = ({ map }) => {
  const { homeLocation, userLocation } = useMapStore();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const position = userLocation ?? homeLocation;

  useEffect(() => {
    if (!map || !position) return;

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(59,130,246,0.25);animation:puckPing 1.6s ease-out infinite;"></div>
          <div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #1e3a5f;box-shadow:0 0 10px rgba(59,130,246,0.5), 0 2px 6px rgba(0,0,0,0.4);position:relative;z-index:1;"></div>
        </div>
        <style>@keyframes puckPing{0%{transform:scale(0.8);opacity:0.7;}100%{transform:scale(2.2);opacity:0;}}</style>
      `;
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.backgroundColor = "transparent";

      markerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "center",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
    }

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Keep marker at fixed mirror location
  useEffect(() => {
    if (!markerRef.current || !position) return;
    markerRef.current.setLngLat([position.lng, position.lat]);
  }, [position]);

  return null;
};

export default UserPuck;
