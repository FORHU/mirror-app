"use client";

import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

export function useMapCamera(map: mapboxgl.Map | null) {
  const isNavigating = useMapStore((state) => state.isNavigating);
  const activeRoute = useMapStore((state) => state.activeRoute);
  const cameraMode = useMapStore((state) => state.cameraMode);
  const homeLocation = useMapStore((state) => state.homeLocation);

  useEffect(() => {
    if (!map || !isNavigating || !activeRoute) return;

    if (cameraMode === "overview") {
      const coords: [number, number][] = ((
        activeRoute.geojson?.features?.[0]?.geometry as
          | GeoJSON.LineString
          | undefined
      )?.coordinates ?? []) as [number, number][];
      if (coords.length === 0) return;

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
      );
      map.stop();
      map.fitBounds(bounds, {
        padding: { top: 130, bottom: 120, left: 60, right: 60 },
        pitch: 0,
        bearing: 0,
        duration: 1800,
        essential: true,
      });
      return;
    }

    // Follow — flat top-down, centered on home/origin
    const center: [number, number] | null = homeLocation
      ? [homeLocation.lng, homeLocation.lat]
      : null;
    if (!center) return;

    map.stop();
    setTimeout(() => {
      map.easeTo({
        center,
        zoom: 17,
        pitch: 0,
        bearing: 0,
        duration: 2000,
        essential: true,
      });
    }, 100);
  }, [map, isNavigating, activeRoute, cameraMode, homeLocation]);
}
