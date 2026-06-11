"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";
import { stopColor } from "../constants/stopColors";

const SOURCE_ID = "itinerary-route";

// Mapbox Standard style uses a slot system. Without "top", custom line layers
// render below the style's own road network, appearing dark/buried.
const SLOT = "top";

function addLayers(map: mapboxgl.Map) {
  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // Outer colour halo — emissive so night atmosphere doesn't dim it
  map.addLayer({
    id: "itinerary-route-glow-outer",
    type: "line",
    source: SOURCE_ID,
    slot: SLOT,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "color"], "#FBBF24"],
      "line-width": 20,
      "line-opacity": 0.45,
      "line-blur": 6,
      "line-emissive-strength": 1,
    },
  });

  // Inner glow
  map.addLayer({
    id: "itinerary-route-glow",
    type: "line",
    source: SOURCE_ID,
    slot: SLOT,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "color"], "#FBBF24"],
      "line-width": 12,
      "line-opacity": 0.75,
      "line-blur": 2,
      "line-emissive-strength": 1,
    },
  });

  // Core line — solid, full-opacity, stop-coloured, fully emissive
  map.addLayer({
    id: "itinerary-route-line",
    type: "line",
    source: SOURCE_ID,
    slot: SLOT,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "color"], "#FBBF24"],
      "line-width": 6,
      "line-opacity": 1,
      "line-emissive-strength": 1,
    },
  });

  // Bright hot-centre streak
  map.addLayer({
    id: "itinerary-route-core",
    type: "line",
    source: SOURCE_ID,
    slot: SLOT,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": 2,
      "line-opacity": 0.85,
      "line-blur": 0,
      "line-emissive-strength": 1,
    },
  });
}

const ItineraryRouteLayer: React.FC<{ map: mapboxgl.Map }> = ({ map }) => {
  const itineraryRoutes = useMapStore((s) => s.itineraryRoutes);

  useEffect(() => {
    if (!map) return;

    if (!map.getSource(SOURCE_ID)) {
      addLayers(map);
    }

    // Re-add after style reload (Standard style wipes custom layers on style change)
    const onStyleLoad = () => {
      if (!map.getSource(SOURCE_ID)) addLayers(map);
    };
    map.on("style.load", onStyleLoad);

    // Each leg's color matches its destination stop (index i → stop i)
    const features = itineraryRoutes
      .map((r, i) => {
        const feature = (r.geojson as { features?: unknown[] })
          ?.features?.[0] as GeoJSON.Feature | undefined;
        if (!feature) return null;
        return {
          ...feature,
          properties: { ...(feature.properties ?? {}), color: stopColor(i) },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[];

    (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });

    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [map, itineraryRoutes]);

  return null;
};

export default ItineraryRouteLayer;
