"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface UserPuckProps {
  map: mapboxgl.Map;
}

const UserPuck: React.FC<UserPuckProps> = ({ map }) => {
  const { homeLocation, userLocation, isNavigating, activeRoute } =
    useMapStore();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Live position: prefer GPS, fall back to stored home location
  const position = userLocation ?? homeLocation;

  // Create marker and update icon style when nav state changes
  useEffect(() => {
    if (!map || !position) return;

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "user-puck";
      markerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "top",
        rotationAlignment: "viewport",
        pitchAlignment: "viewport",
      })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
    }

    const el = markerRef.current.getElement();

    if (isNavigating && activeRoute) {
      el.innerHTML = `
        <div style="filter: drop-shadow(0 0 10px rgba(59,130,246,0.8));">
          <svg width="50" height="50" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2L38 36L20 26L2 36L20 2Z" fill="#3b82f6" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
      markerRef.current.setRotation(0);
      el.style.width = "50px";
      el.style.height = "50px";
      el.style.backgroundColor = "transparent";
      el.style.borderRadius = "0";
      el.style.boxShadow = "none";
    } else {
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
      el.style.borderRadius = "0";
      el.style.border = "none";
      el.style.boxShadow = "none";
    }

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isNavigating, activeRoute]);

  // Smoothly move the marker as GPS updates — no marker recreation
  useEffect(() => {
    if (!markerRef.current || !position) return;
    markerRef.current.setLngLat([position.lng, position.lat]);
  }, [position]);

  return null;
};

export default UserPuck;
