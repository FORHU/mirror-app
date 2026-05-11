"use client";

import { useEffect, useRef } from "react";
import { useMap } from "../components/MapProvider";
import { CINEMATIC_CONFIG } from "../constants/config";

export const useMapCamera = () => {
  const { map } = useMap();
  const requestRef = useRef<number>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  const animate = () => {
    if (!map) return;

    const now = Date.now();
    const timeSinceInteraction = now - lastInteractionRef.current;

    if (timeSinceInteraction > CINEMATIC_CONFIG.idleDelay) {
      const bearing = map.getBearing();
      map.setBearing(bearing + CINEMATIC_CONFIG.rotationSpeed);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!map) return;

    // Initial fly-in
    map.flyTo({
      zoom: 15.5,
      pitch: 75,
      duration: CINEMATIC_CONFIG.flyInDuration,
      essential: true,
    });

    const handleInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    map.on("mousedown", handleInteraction);
    map.on("wheel", handleInteraction);
    map.on("touchstart", handleInteraction);

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      map.off("mousedown", handleInteraction);
      map.off("wheel", handleInteraction);
      map.off("touchstart", handleInteraction);
    };
  }, [map]);

  return null;
};
