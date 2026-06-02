"use client";

import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

export function useMapCamera(map: mapboxgl.Map | null) {
  const activeRoute = useMapStore((state) => state.activeRoute);
  const cameraMode = useMapStore((state) => state.cameraMode);
  const homeLocation = useMapStore((state) => state.homeLocation);

  // Fit route bounds whenever a route loads
  useEffect(() => {
    if (!map || !activeRoute) return;

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
      padding: { top: 130, bottom: 220, left: 60, right: 60 },
      pitch: 0,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
  }, [map, activeRoute]);

  // When route is cleared, recenter to mirror location
  useEffect(() => {
    if (!map || activeRoute || !homeLocation || cameraMode !== "overview") return;

    map.stop();
    map.easeTo({
      center: [homeLocation.lng, homeLocation.lat],
      zoom: 14,
      pitch: 0,
      bearing: 0,
      duration: 1200,
      essential: true,
    });
  }, [map, activeRoute, homeLocation, cameraMode]);
}
