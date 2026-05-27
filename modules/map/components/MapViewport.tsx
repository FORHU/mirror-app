"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "@/modules/shared/config/device.config";
import { useMapStore } from "../store/useMapStore";
import RouteLayer from "./RouteLayer";
import UserPuck from "./UserPuck";
import DestinationPin from "./DestinationPin";
import NearbyPOILayer from "./NearbyPOILayer";
import { useMapCamera } from "../hooks/useMapCamera";

mapboxgl.accessToken = MAPBOX_TOKEN;

const MapViewport = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setLocalMap] = useState<mapboxgl.Map | null>(null);
  const { homeLocation, setSelectedPOI, showTraffic, showTerrain, setMap } =
    useMapStore();

  // Use camera hook
  useMapCamera(map);

  useEffect(() => {
    if (!mapContainerRef.current || !homeLocation) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [homeLocation.lng, homeLocation.lat],
      zoom: 15,
      pitch: 0,
      bearing: 0,
      antialias: true,
    });

    mapInstance.on("load", () => {
      mapInstance.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        paint: {
          "fill-extrusion-color": "#d4d4d8",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.6,
        },
      });

      setLocalMap(mapInstance);
      setMap(mapInstance);

      // Handle map clicks for discovery
      mapInstance.on("click", (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);

        // Let NearbyPOILayer's layer-specific handler own clicks on custom POI dots
        if (features.some((f) => f.layer?.id === "nearby-pois-dot")) return;

        const namedFeature = features.find(
          (f) => f.properties?.name || f.properties?.name_en,
        );

        if (namedFeature) {
          const name =
            namedFeature.properties?.name || namedFeature.properties?.name_en;
          setSelectedPOI({
            name,
            category:
              namedFeature.properties?.type ||
              namedFeature.properties?.class ||
              "Location",
            location: { lng: e.lngLat.lng, lat: e.lngLat.lat },
            layerId: namedFeature.layer?.id ?? "",
          });
        } else {
          setSelectedPOI(null);
        }
      });

      // Change cursor on hover
      mapInstance.on("mousemove", (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);
        const namedFeature = features.find(
          (f) => f.properties?.name || f.properties?.name_en,
        );
        mapInstance.getCanvas().style.cursor = namedFeature ? "pointer" : "";
      });
    });

    return () => {
      mapInstance.remove();
    };
  }, [homeLocation, setMap, setSelectedPOI]); // Only init once when homeLocation is ready

  // Handle Traffic and Terrain toggles
  useEffect(() => {
    if (!map) return;

    // Traffic — add Mapbox traffic tileset on demand, hide/show without removing
    const TRAFFIC_SRC = "mapbox-traffic-v1";
    const TRAFFIC_LAYER = "traffic-congestion";

    if (showTraffic) {
      if (!map.getSource(TRAFFIC_SRC)) {
        map.addSource(TRAFFIC_SRC, {
          type: "vector",
          url: "mapbox://mapbox.mapbox-traffic-v1",
        });
      }
      if (!map.getLayer(TRAFFIC_LAYER)) {
        map.addLayer({
          id: TRAFFIC_LAYER,
          type: "line",
          source: TRAFFIC_SRC,
          "source-layer": "traffic",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 4],
            "line-color": [
              "match",
              ["get", "congestion"],
              "low",
              "#4ade80",
              "moderate",
              "#fbbf24",
              "heavy",
              "#f97316",
              "severe",
              "#ef4444",
              "#4ade80",
            ],
          },
        });
      } else {
        map.setLayoutProperty(TRAFFIC_LAYER, "visibility", "visible");
      }
    } else {
      if (map.getLayer(TRAFFIC_LAYER)) {
        map.setLayoutProperty(TRAFFIC_LAYER, "visibility", "none");
      }
    }

    // Terrain
    if (showTerrain) {
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
    } else {
      map.setTerrain(null);
    }
  }, [map, showTraffic, showTerrain]);

  return (
    <div ref={mapContainerRef} className="w-full h-full">
      {map && (
        <>
          <RouteLayer map={map} />
          <NearbyPOILayer map={map} />
          <UserPuck map={map} />
          <DestinationPin map={map} />
        </>
      )}
    </div>
  );
};

export default React.memo(MapViewport);
