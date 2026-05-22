"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";

interface Props { map: mapboxgl.Map; }

const SOURCE = "nearby-pois";
const LAYER_GLOW  = "nearby-pois-glow";
const LAYER_DOT   = "nearby-pois-dot";
const LAYER_LABEL = "nearby-pois-label";

export default function NearbyPOILayer({ map }: Props) {
  const { nearbyPOIs, setSelectedPOI } = useMapStore();
  const nearbyPOIsRef = useRef(nearbyPOIs);
  nearbyPOIsRef.current = nearbyPOIs;

  useEffect(() => {
    if (!map) return;

    const init = () => {
      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer(LAYER_GLOW)) {
        map.addLayer({
          id: LAYER_GLOW,
          type: "circle",
          source: SOURCE,
          paint: {
            "circle-radius": 22,
            "circle-color": "#4fc3f7",
            "circle-opacity": 0.25,
            "circle-blur": 1,
          },
        });
      }

      if (!map.getLayer(LAYER_DOT)) {
        map.addLayer({
          id: LAYER_DOT,
          type: "circle",
          source: SOURCE,
          paint: {
            "circle-radius": 11,
            "circle-color": "#4fc3f7",
            "circle-opacity": 1,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      if (!map.getLayer(LAYER_LABEL)) {
        map.addLayer({
          id: LAYER_LABEL,
          type: "symbol",
          source: SOURCE,
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": 11,
            "text-offset": [0, 1.8],
            "text-anchor": "top",
            "text-max-width": 8,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.9)",
            "text-halo-width": 2,
          },
        });
      }

      // Re-populate after style reload
      const pois = nearbyPOIsRef.current;
      if (pois.length) {
        (map.getSource(SOURCE) as mapboxgl.GeoJSONSource)?.setData(buildGeojson(pois));
      }
    };

    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const { name, category, address, lat, lng, fsqId, photo } = f.properties as any;
      setSelectedPOI({
        name,
        category,
        address,
        location: { lng, lat },
        fsqId,
        photo: photo || null,
      });
    };

    init();
    map.on("style.load", init);
    map.on("click", LAYER_DOT, handleClick);
    map.on("mouseenter", LAYER_DOT, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", LAYER_DOT, () => { map.getCanvas().style.cursor = ""; });

    return () => {
      map.off("style.load", init);
      map.off("click", LAYER_DOT, handleClick);
    };
  }, [map, setSelectedPOI]);

  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(buildGeojson(nearbyPOIs));
  }, [map, nearbyPOIs]);

  return null;
}

function buildGeojson(pois: any[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pois.map((poi) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [poi.lng, poi.lat] },
      properties: {
        name:     poi.name,
        category: poi.category,
        address:  poi.address,
        lat:      poi.lat,
        lng:      poi.lng,
        fsqId:    poi.fsqId,
        photo:    poi.photo ?? "",
      },
    })),
  };
}
