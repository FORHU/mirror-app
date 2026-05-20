"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface UserPuckProps {
  map: mapboxgl.Map;
}

const UserPuck: React.FC<UserPuckProps> = ({ map }) => {
  const { homeLocation, isNavigating, activeRoute } = useMapStore();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map || !homeLocation) return;

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "user-puck";
      markerRef.current = new mapboxgl.Marker({ 
        element: el,
        anchor: 'top',              // Arrow tip (top of SVG) points at the coordinate
        rotationAlignment: 'viewport',
        pitchAlignment: 'viewport',
      })
        .setLngLat([homeLocation.lng, homeLocation.lat])
        .addTo(map);
    }

    const el = markerRef.current.getElement();
    
    if (isNavigating && activeRoute) {
      el.innerHTML = `
        <div style="filter: drop-shadow(0 0 10px rgba(79,195,247,0.8));">
          <svg width="50" height="50" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2L38 36L20 26L2 36L20 2Z" fill="#4fc3f7" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
      // rotationAlignment:'map' means the marker inherits the map's bearing automatically.
      // The camera is already rotated to face the route, so setRotation(0) = "same as camera".
      // Setting any other value would be an offset ON TOP of the map bearing (double-rotation).
      markerRef.current.setRotation(0);
      el.style.width = "50px";
      el.style.height = "50px";
      el.style.backgroundColor = "transparent";
      el.style.borderRadius = "0";
      el.style.boxShadow = "none";
    } else {
      // Standard standby dot
      el.innerHTML = "";
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.backgroundColor = "#ffffff";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid #4fc3f7";
      el.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.6)";
    }

    markerRef.current.setLngLat([homeLocation.lng, homeLocation.lat]);

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map, homeLocation, isNavigating, activeRoute]);

  return null;
};

export default UserPuck;
