"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface RouteLayerProps {
  map: mapboxgl.Map;
}

const RouteLayer: React.FC<RouteLayerProps> = ({ map }) => {
  const activeRoute = useMapStore((state) => state.activeRoute);

  useEffect(() => {
    if (!map) return;

    if (!map.getSource("route")) {
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Wide atmosphere halo
      map.addLayer({
        id: "route-glow-outer",
        type: "line",
        source: "route",
        slot: "top",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#93c5fd",
          "line-width": 32,
          "line-opacity": 0.25,
          "line-blur": 14,
          "line-emissive-strength": 1,
        },
      });

      // Inner glow
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        slot: "top",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 16,
          "line-opacity": 0.55,
          "line-blur": 5,
          "line-emissive-strength": 1,
        },
      });

      // Core line
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        slot: "top",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 6,
          "line-opacity": 1,
          "line-blur": 0,
          "line-emissive-strength": 1,
        },
      });

      // Bright hot-centre streak
      map.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        slot: "top",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#bfdbfe",
          "line-width": 2,
          "line-opacity": 0.9,
          "line-blur": 0,
          "line-emissive-strength": 1,
        },
      });
    }

    if (activeRoute?.geojson) {
      (map.getSource("route") as mapboxgl.GeoJSONSource).setData(
        activeRoute.geojson,
      );
    } else {
      (map.getSource("route") as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, [map, activeRoute]);

  return null;
};

export default RouteLayer;
