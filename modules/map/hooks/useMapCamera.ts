"use client";

import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

export function useMapCamera(map: mapboxgl.Map | null) {
  const activeRoute = useMapStore((state) => state.activeRoute);
  const cameraMode = useMapStore((state) => state.cameraMode);
  const homeLocation = useMapStore((state) => state.homeLocation);
  const itineraryStops = useMapStore((state) => state.itineraryStops);
  const itineraryRoutes = useMapStore((state) => state.itineraryRoutes);
  const suggestedPOIs = useMapStore((state) => state.suggestedPOIs);
  const setIsPanning = useMapStore((state) => state.setIsPanning);

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
    setIsPanning(true);
    map.fitBounds(bounds, {
      padding: { top: 130, bottom: 220, left: 60, right: 60 },
      pitch: 0,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
    map.once("moveend", () => setIsPanning(false));
  }, [map, activeRoute, setIsPanning]);

  // Fit all itinerary legs in view when stops or routes change
  useEffect(() => {
    if (!map || itineraryStops.length === 0) return;

    const allCoords: [number, number][] = [];
    for (const route of itineraryRoutes) {
      const coords =
        (
          route.geojson?.features?.[0]?.geometry as
            | GeoJSON.LineString
            | undefined
        )?.coordinates ?? [];
      allCoords.push(...(coords as [number, number][]));
    }
    if (allCoords.length === 0) {
      itineraryStops.forEach((s) => allCoords.push([s.lng, s.lat]));
    }
    if (allCoords.length === 0) return;

    const bounds = allCoords.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(allCoords[0], allCoords[0]),
    );
    map.stop();
    setIsPanning(true);
    map.fitBounds(bounds, {
      padding: { top: 130, bottom: 220, left: 60, right: 60 },
      pitch: 0,
      bearing: 0,
      duration: 1800,
      essential: true,
    });
    map.once("moveend", () => setIsPanning(false));
  }, [map, itineraryStops, itineraryRoutes, setIsPanning]);

  // Fit suggested POIs in view when they load
  useEffect(() => {
    if (!map || suggestedPOIs.length === 0) return;

    const bounds = suggestedPOIs.reduce(
      (b, poi) => b.extend([poi.lng, poi.lat] as [number, number]),
      new mapboxgl.LngLatBounds(
        [suggestedPOIs[0].lng, suggestedPOIs[0].lat],
        [suggestedPOIs[0].lng, suggestedPOIs[0].lat],
      ),
    );
    map.stop();
    setIsPanning(true);
    map.fitBounds(bounds, {
      padding: { top: 130, bottom: 220, left: 60, right: 60 },
      maxZoom: 15,
      duration: 1200,
      essential: true,
    });
    map.once("moveend", () => setIsPanning(false));
  }, [map, suggestedPOIs, setIsPanning]);

  // When route is cleared, recenter to mirror location
  useEffect(() => {
    if (!map || activeRoute || !homeLocation || cameraMode !== "overview")
      return;

    map.stop();
    setIsPanning(true);
    map.easeTo({
      center: [homeLocation.lng, homeLocation.lat],
      zoom: 14,
      pitch: 0,
      bearing: 0,
      duration: 1200,
      essential: true,
    });
    map.once("moveend", () => setIsPanning(false));
  }, [map, activeRoute, homeLocation, cameraMode, setIsPanning]);
}
