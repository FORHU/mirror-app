"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "@/modules/shared/config/device.config";
import { useMapStore } from "../store/useMapStore";
import { applyMirrorStyle } from "../utils/mirrorStyle";
import RouteLayer from "./RouteLayer";
import UserPuck from "./UserPuck";
import DestinationPin from "./DestinationPin";
import { useMapCamera } from "../hooks/useMapCamera";

mapboxgl.accessToken = MAPBOX_TOKEN;

const MapViewport = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setLocalMap] = useState<mapboxgl.Map | null>(null);
  const { homeLocation, setSelectedPOI, showTraffic, showTerrain, setMap } = useMapStore();
  
  // Use camera hook
  useMapCamera(map);

  useEffect(() => {
    if (!mapContainerRef.current || !homeLocation) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
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
          "fill-extrusion-color": "#141414",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.6,
        },
      });

      applyMirrorStyle(mapInstance);
      setLocalMap(mapInstance);
      setMap(mapInstance);

      // Handle map clicks for discovery
      mapInstance.on("click", (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);
        const namedFeature = features.find(f => f.properties?.name || f.properties?.name_en);

        if (namedFeature) {
          const name = namedFeature.properties?.name || namedFeature.properties?.name_en;
          setSelectedPOI({
            name,
            category: namedFeature.properties?.type || namedFeature.properties?.class || "Location",
            location: { lng: e.lngLat.lng, lat: e.lngLat.lat },
            layerId: namedFeature.layer?.id
          });
        } else {
          setSelectedPOI(null);
        }
      });

      // Change cursor on hover
      mapInstance.on("mousemove", (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);
        const namedFeature = features.find(f => f.properties?.name || f.properties?.name_en);
        mapInstance.getCanvas().style.cursor = namedFeature ? "pointer" : "";
      });
    });

    mapInstance.on("style.load", () => {
      applyMirrorStyle(mapInstance);
    });

    // Re-apply after first idle so all sprite/tiles are loaded
    mapInstance.once("idle", () => {
      applyMirrorStyle(mapInstance);
    });

    return () => {
      mapInstance.remove();
    };
  }, [homeLocation]); // Only init once when homeLocation is ready

  // Handle Traffic and Terrain toggles
  useEffect(() => {
    if (!map) return;
    
    // Traffic
    if (map.getSource('mapbox-traffic')) {
      const visibility = showTraffic ? 'visible' : 'none';
      map.getStyle().layers?.forEach(layer => {
        if (layer.id.includes('traffic')) {
          map.setLayoutProperty(layer.id, 'visibility', visibility);
        }
      });
    } else if (showTraffic) {
      // Add traffic source if it doesn't exist
      // Note: This requires a style that supports traffic or adding the source manually
      // For now, we assume the dark-v11 has traffic layers we can toggle
    }

    // Terrain
    if (showTerrain) {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          'type': 'raster-dem',
          'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
          'tileSize': 512,
          'maxzoom': 14
        });
      }
      map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
    } else {
      map.setTerrain(null as any);
    }
  }, [map, showTraffic, showTerrain]);

  return (
    <div ref={mapContainerRef} className="w-full h-full">
      {map && (
        <>
          <RouteLayer map={map} />
          <UserPuck map={map} />
          <DestinationPin map={map} />
        </>
      )}
    </div>
  );
};

export default React.memo(MapViewport);
