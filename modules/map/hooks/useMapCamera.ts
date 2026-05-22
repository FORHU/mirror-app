"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

export function useMapCamera(map: mapboxgl.Map | null) {
  const isNavigating  = useMapStore((state) => state.isNavigating);
  const activeRoute   = useMapStore((state) => state.activeRoute);
  const cameraMode    = useMapStore((state) => state.cameraMode);
  const homeLocation  = useMapStore((state) => state.homeLocation);
  const idleRotRef    = useRef<number | null>(null);

  const lerpBearing = (current: number, target: number, factor: number): number => {
    const delta = ((target - current + 540) % 360) - 180;
    return current + delta * factor;
  };

  useEffect(() => {
    if (!map) return;

    if (!isNavigating) {
      if (idleRotRef.current) {
        cancelAnimationFrame(idleRotRef.current);
        idleRotRef.current = null;
      }
      return;
    }

    if (!activeRoute) return;

    // ── OVERVIEW ────────────────────────────────────────────────────
    if (cameraMode === "overview") {
      const geometry = activeRoute.geojson?.features?.[0]?.geometry;
      const coords: [number, number][] =
        geometry?.type === "LineString"
          ? (geometry.coordinates as [number, number][])
          : [];
      if (coords.length === 0) return;

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.stop();
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 120, left: 60, right: 60 },
        pitch: 20, bearing: 0, duration: 1800, essential: true,
      });
      return;
    }

    // ── FOLLOW / FPV ─────────────────────────────────────────────────

    // Center on homeLocation (where the puck is) — NOT coords[0] which is road-snapped
    const center: [number, number] | null = homeLocation
      ? [homeLocation.lng, homeLocation.lat]
      : null;
    if (!center) return;

    // Bearing: prefer Mapbox API value (already road-aligned, accepts 0 = north as valid)
    // API now returns undefined when missing (not 0), so null-check is clean
    const apiBearing: number | undefined = activeRoute.steps?.[0]?.maneuver?.bearing_after;
    const bearing = apiBearing != null ? apiBearing : 0;

    console.log("[Camera] FPV | center:", center, "| bearing:", bearing,
      "| source:", apiBearing != null ? "API" : "default-0");

    if (idleRotRef.current) {
      cancelAnimationFrame(idleRotRef.current);
      idleRotRef.current = null;
    }

    map.stop();
    setTimeout(() => {
      map.easeTo({
        center,
        zoom: 20,
        pitch: 80,
        bearing,
        duration: 3000,
        essential: true,
        // Push map content upward so puck appears at bottom-center (Waze/Google Maps style)
        padding: { top: 500, bottom: 0, left: 0, right: 0 },
      });
    }, 100);

    return () => {
      if (idleRotRef.current) cancelAnimationFrame(idleRotRef.current);
    };
  }, [map, isNavigating, activeRoute, cameraMode, homeLocation]);

  const flyToFPV = (center: [number, number], bearing: number) => {
    if (!map) return;
    map.flyTo({ center, zoom: 18.5, pitch: 70, bearing, duration: 2200, easing: (t) => t * (2 - t) });
  };

  const easeToFPV = (center: [number, number], targetBearing: number) => {
    if (!map) return;
    map.stop();
    map.easeTo({
      center,
      bearing: lerpBearing(map.getBearing(), targetBearing, 0.25),
      pitch: 70,
      zoom: 18.5,
      duration: 800,
      easing: (t) => t,
    });
  };

  return { flyToFPV, easeToFPV, lerpBearing };
}
