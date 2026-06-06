"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "@/modules/shared/config/device.config";
import { useMapStore } from "../store/useMapStore";
import RouteLayer from "./RouteLayer";
import UserPuck from "./UserPuck";
import DestinationPin from "./DestinationPin";
import ItineraryRouteLayer from "./ItineraryRouteLayer";
import ItineraryPins from "./ItineraryPins";
import { useMapCamera } from "../hooks/useMapCamera";

mapboxgl.accessToken = MAPBOX_TOKEN;

const MapViewport = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setLocalMap] = useState<mapboxgl.Map | null>(null);
  // Do NOT subscribe to userLocation — GPS updates every 10-20 s would
  // re-evaluate initialCenter and reinitialize the entire Mapbox instance.
  const { setSelectedPOI, showTraffic, setMap } = useMapStore();

  // Capture the initial center exactly once at mount. Reading from the Zustand
  // snapshot (getState) avoids any reactive dependency on live location updates.
  const initialCenterRef = useRef<{ lat: number; lng: number } | null>(
    useMapStore.getState().homeLocation ?? useMapStore.getState().userLocation,
  );

  useMapCamera(map);

  useEffect(() => {
    const initialCenter = initialCenterRef.current;
    if (!mapContainerRef.current || !initialCenter) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 15,
      pitch: 0,
      bearing: 0,
    });

    mapInstance.on("style.load", () => {
      mapInstance.setConfigProperty("basemap", "showPointsOfInterest", false);
      mapInstance.setConfigProperty(
        "basemap",
        "showPointOfInterestLabels",
        false,
      );
      mapInstance.setConfigProperty("basemap", "showTransitLabels", false);
      mapInstance.setConfigProperty("basemap", "lightPreset", "night");
    });

    mapInstance.on("load", () => {
      setLocalMap(mapInstance);
      setMap(mapInstance);

      mapInstance.on("click", (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMap, setSelectedPOI]);

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
          <ItineraryRouteLayer map={map} />
          <UserPuck map={map} />
          <DestinationPin map={map} />
          <ItineraryPins map={map} />
        </>
      )}
    </div>
  );
};

export default React.memo(MapViewport);
