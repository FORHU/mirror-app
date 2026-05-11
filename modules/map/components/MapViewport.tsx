"use client";

import React, { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMap } from "./MapProvider";
import { useMapStore } from "../store/useMapStore";
import { MAPBOX_TOKEN, INITIAL_VIEW_STATE, MAP_STYLES } from "../constants/config";
import { useTheme } from "next-themes";

interface MapViewportProps {
  className?: string;
}

export const MapViewport: React.FC<MapViewportProps> = React.memo(({ className }) => {
  const { map, setMap, mapContainerRef } = useMap();
  const { resolvedTheme } = useTheme();

  const mapStyle = useMemo(() => {
    return resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light;
  }, [resolvedTheme]);

  useEffect(() => {
    console.log("Mapbox Token present:", !!MAPBOX_TOKEN);
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
      antialias: true,
    });

    mapInstance.on("load", () => {
      console.log("Map instance loaded successfully");
      setMap(mapInstance);
      
      // Mapbox Standard style automatically includes 3D buildings, landmarks, and POI icons.
    });

    mapInstance.on("error", (e: any) => {
      console.error("Detailed Mapbox Error:", {
        message: e.error?.message,
        error: e.error,
        source: e.sourceId,
        type: e.type
      });
    });

    return () => {
      mapInstance.remove();
      setMap(null);
    };
  }, [mapContainerRef, setMap, mapStyle]);

  const { destination } = useMapStore();

  useEffect(() => {
    if (!map || !destination) return;

    const flyToDestination = () => {
      const currentCenter = map.getCenter();
      const distance = Math.sqrt(
        Math.pow(destination.center[0] - currentCenter.lng, 2) + 
        Math.pow(destination.center[1] - currentCenter.lat, 2)
      );

      // If distance is very large (> 10 degrees), jump instead of fly to prevent engine stalls
      if (distance > 10) {
        console.log("Large distance detected, jumping to destination");
        map.jumpTo({
          center: destination.center,
          zoom: 16,
          pitch: 50
        });
      } else {
        console.log("Flying to destination:", destination.center);
        // Capture current state to lock it during flight
        const currentBearing = map.getBearing();
        const currentPitch = map.getPitch();

        map.flyTo({
          center: destination.center,
          zoom: 16,
          pitch: currentPitch,
          bearing: currentBearing,
          duration: 5000,
          curve: 1.42,
          speed: 0.8,
          essential: true
        });
      }
    };

    if (map.isStyleLoaded()) {
      flyToDestination();
    } else {
      map.once("style.load", flyToDestination);
    }
  }, [map, destination]);

  return (
    <div 
      ref={mapContainerRef} 
      className={`w-full h-full ${className || ""}`}
      style={{ position: "absolute", inset: 0 }}
    />
  );
});

MapViewport.displayName = "MapViewport";
