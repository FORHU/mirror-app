"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface RouteLayerProps {
  map: mapboxgl.Map;
}

const RouteLayer: React.FC<RouteLayerProps> = ({ map }) => {
  const activeRoute = useMapStore((state) => state.activeRoute);
  const lastTripGeojson = useMapStore((state) => state.lastTripGeojson);

  useEffect(() => {
    if (!map) return;

    if (!map.getSource("last-trip")) {
      map.addSource("last-trip", {
        type: "geojson",
        data: lastTripGeojson ?? { type: "FeatureCollection", features: [] },
      });

      // Ghost overlay of the previous trip
      map.addLayer({
        id: "last-trip-line",
        type: "line",
        source: "last-trip",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-opacity": 0.18,
          "line-dasharray": [4, 4],
        },
      });
    }

    if (!map.getSource("route")) {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      // Soft outer glow
      map.addLayer({
        id: "route-glow-outer",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#00cfff",
          "line-width": 18,
          "line-opacity": 0.25,
          "line-blur": 8,
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
          "line-width": 10,
          "line-opacity": 0.55,
          "line-blur": 4,
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
          "line-width": 3,
          "line-opacity": 1,
          "line-blur": 0,
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

    if (map.getSource("last-trip")) {
      (map.getSource("last-trip") as mapboxgl.GeoJSONSource).setData(
        lastTripGeojson ?? { type: "FeatureCollection", features: [] },
      );
    }
  }, [map, activeRoute, lastTripGeojson]);

  return null;
};

export default RouteLayer;
