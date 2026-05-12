"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMap } from "./MapProvider";
import { useMapStore } from "../store/useMapStore";

export const RouteLayer = () => {
  const { map } = useMap();
  const { activeRoute } = useMapStore();

  useEffect(() => {
    if (!map || !activeRoute) return;

    const route = activeRoute?.routes?.[0]?.geometry;
    if (!route) return;
    
    const sourceId = "route-source";
    const layerIds = ["route-glow", "route-casing", "route-core"];

    const data: any = {
      type: "Feature",
      properties: {},
      geometry: route,
    };

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "geojson", data });
      
      // 1. Wide Outer Glow (Waze Style)
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffeb3b",
          "line-width": 18,
          "line-opacity": 0.4,
          "line-blur": 12
        },
      });

      // 2. High-Contrast Casing
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 10,
          "line-opacity": 0.9,
        },
      });

      // 3. Vibrant Core Path
      map.addLayer({
        id: "route-core",
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#facc15",
          "line-width": 6,
        },
      });
    } else {
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData(data);
    }

    // Zoom to fit route
    const coordinates = (route as any).coordinates;
    const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
    coordinates.forEach((coord: [number, number]) => bounds.extend(coord));

    const camera = map.cameraForBounds(bounds, { padding: 100 });
    if (camera) {
      map.easeTo({ ...camera, duration: 2000, essential: true });
    }

    return () => {
      layerIds.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, activeRoute]);

  return null;
};
