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

      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#4fc3f7",
          "line-width": 5,
          "line-opacity": 0.9,
          "line-blur": 2,
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
