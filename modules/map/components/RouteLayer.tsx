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
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Outermost diffuse bloom
      map.addLayer({
        id: "route-glow-outer",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00cfff",
          "line-width": 60,
          "line-opacity": 0.18,
          "line-blur": 30,
        },
      });

      // Mid glow
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00d4ff",
          "line-width": 28,
          "line-opacity": 0.55,
          "line-blur": 10,
        },
      });

      // Inner bright halo
      map.addLayer({
        id: "route-glow-inner",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#7ee8ff",
          "line-width": 10,
          "line-opacity": 0.9,
          "line-blur": 3,
        },
      });

      // Core line
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 4,
          "line-opacity": 1,
          "line-blur": 0,
        },
      });
    }

    if (activeRoute && activeRoute.geojson) {
      (map.getSource("route") as mapboxgl.GeoJSONSource).setData(activeRoute.geojson);
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
