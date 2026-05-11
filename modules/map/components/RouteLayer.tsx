"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMap } from "./MapProvider";
import { useMapStore } from "../store/useMapStore";

export const RouteLayer = () => {
  const { map } = useMap();
  const { activeRoute, destination } = useMapStore();

  useEffect(() => {
    if (!map || !activeRoute) return;

    const route = activeRoute?.routes?.[0]?.geometry;
    if (!route) return;
    const sourceId = "route-source";
    const layerId = "route-layer";
    const glowId = "route-glow";

    // Add source if not exists
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: route as any,
        },
      });

      // Add glow effect
      map.addLayer({
        id: glowId,
        type: "line",
        source: sourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#8b7fc7",
          "line-width": 8,
          "line-blur": 8,
          "line-opacity": 0.4,
        },
      });

      // Add main route line
      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#8b7fc7",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
    } else {
      // Update data if source already exists
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      source.setData({
        type: "Feature",
        properties: {},
        geometry: route as any,
      });
    }

    // Zoom to fit route
    const coordinates = (route as any).coordinates;
    const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
    
    coordinates.forEach((coord: [number, number]) => {
      bounds.extend(coord);
    });

    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    const camera = map.cameraForBounds(bounds, {
      padding: 100
    });

    if (camera) {
      map.flyTo({
        ...camera,
        duration: 2000,
        pitch: currentPitch,
        bearing: currentBearing,
        essential: true
      });
    }

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getLayer(glowId)) map.removeLayer(glowId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, activeRoute]);

  return null;
};
