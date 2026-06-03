"use client";

import React, { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

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

      map.addLayer({
        id: "itinerary-route-glow-outer",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#a78bfa", "line-width": 18, "line-opacity": 0.2, "line-blur": 8 },
      });

      map.addLayer({
        id: "itinerary-route-glow",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#a78bfa", "line-width": 10, "line-opacity": 0.45, "line-blur": 4 },
      });

      map.addLayer({
        id: "itinerary-route-line",
        type: "line",
        source: SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#a78bfa", "line-width": 4, "line-opacity": 1 },
      });
    }

    const features = itineraryRoutes
      .map((r) => r.geojson?.features?.[0])
      .filter(Boolean) as GeoJSON.Feature[];

    (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [map, itineraryRoutes]);

  return null;
};

export default ItineraryRouteLayer;
