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

const REFETCH_THRESHOLD_M = 500;

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

mapboxgl.accessToken = MAPBOX_TOKEN;

const MapViewport = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setLocalMap] = useState<mapboxgl.Map | null>(null);
  const lastFetchRef = useRef<{ lat: number; lng: number } | null>(null);
  const { homeLocation, setSelectedPOI, showTraffic, setMap, fetchNearbyPOIs } =
    useMapStore();

  // Use camera hook
  useMapCamera(map);

  useEffect(() => {
    if (!mapContainerRef.current || !homeLocation) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [homeLocation.lng, homeLocation.lat],
      zoom: 15,
      pitch: 0,
      bearing: 0,
    });

    mapInstance.on("style.load", () => {
      mapInstance.setConfigProperty(
        "basemap",
        "showPointOfInterestLabels",
        true,
      );
      mapInstance.setConfigProperty("basemap", "lightPreset", "night");
    });

    mapInstance.on("load", () => {
      setLocalMap(mapInstance);
      setMap(mapInstance);

      // Initial POI fetch on map load
      if (homeLocation) {
        lastFetchRef.current = homeLocation;
        fetchNearbyPOIs(homeLocation);
      }

      // Re-fetch POIs on pan when center drifts > 500m from last fetch
      let moveTimer: ReturnType<typeof setTimeout> | null = null;
      mapInstance.on("moveend", () => {
        if (moveTimer) clearTimeout(moveTimer);
        moveTimer = setTimeout(() => {
          const center = mapInstance.getCenter();
          const current = { lat: center.lat, lng: center.lng };
          const last = lastFetchRef.current;
          if (!last || haversineM(last, current) > REFETCH_THRESHOLD_M) {
            lastFetchRef.current = current;
            fetchNearbyPOIs(current);
          }
        }, 400);
      });

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
  }, [homeLocation, setMap, setSelectedPOI, fetchNearbyPOIs]); // Only init once when homeLocation is ready

  // Handle Traffic toggle
  useEffect(() => {
    if (!map) return;

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
  }, [map, showTraffic]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ filter: "brightness(0.75)" }}
    >
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
