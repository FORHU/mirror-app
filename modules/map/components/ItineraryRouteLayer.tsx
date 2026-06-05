"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";
import { stopColor } from "../constants/stopColors";

const SOURCE_ID = "itinerary-route";

const ItineraryRouteLayer: React.FC<{ map: mapboxgl.Map }> = ({ map }) => {
  const itineraryRoutes = useMapStore((s) => s.itineraryRoutes);

  useEffect(() => {
    if (!map) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Wide atmosphere halo
      map.addLayer({
        id: "itinerary-route-outline",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 36,
          "line-opacity": 0.12,
          "line-blur": 16,
        },
      });

      // Outer colour halo
      map.addLayer({
        id: "itinerary-route-glow-outer",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 28,
          "line-opacity": 0.4,
          "line-blur": 12,
        },
      });

      // Inner glow
      map.addLayer({
        id: "itinerary-route-glow",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 16,
          "line-opacity": 0.7,
          "line-blur": 4,
        },
      });

      // Core line
      map.addLayer({
        id: "itinerary-route-line",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 7,
          "line-opacity": 1,
        },
      });

      // Bright hot-centre streak
      map.addLayer({
        id: "itinerary-route-core",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-opacity": 0.6,
          "line-blur": 0,
        },
      });
    }

    // Each leg's color matches its destination stop (index i → stop i)
    const features = itineraryRoutes
      .map((r, i) => {
        const feature = r.geojson?.features?.[0];
        if (!feature) return null;
        return {
          ...feature,
          properties: { ...(feature.properties ?? {}), color: stopColor(i) },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[];

    (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [map, itineraryRoutes]);

  return null;
};

export default ItineraryRouteLayer;
