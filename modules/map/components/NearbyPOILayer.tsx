"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";
import type { NearbyPOI } from "../services/map.service";

interface Props {
  map: mapboxgl.Map;
}

const SOURCE = "nearby-pois";
const LAYER_CLUSTER = "nearby-pois-cluster";
const LAYER_CLUSTER_COUNT = "nearby-pois-cluster-count";
const LAYER_GLOW = "nearby-pois-glow";
const LAYER_DOT = "nearby-pois-dot";
const LAYER_LABEL = "nearby-pois-label";

const CATEGORY_COLOR: [string, string][] = [
  ["restaurant", "#f43f5e"],
  ["cafe", "#f97316"],
  ["coffee", "#f97316"],
  ["park", "#22c55e"],
  ["garden", "#22c55e"],
  ["transit", "#3b82f6"],
  ["bus", "#3b82f6"],
  ["train", "#3b82f6"],
  ["rail", "#3b82f6"],
  ["shop", "#a78bfa"],
  ["store", "#a78bfa"],
  ["mall", "#a78bfa"],
  ["hospital", "#fb923c"],
  ["pharmacy", "#fb923c"],
  ["medical", "#fb923c"],
  ["hotel", "#facc15"],
  ["lodging", "#facc15"],
];

function categoryColor(): mapboxgl.Expression {
  const expr: mapboxgl.Expression = [
    "match",
    ["downcase", ["get", "category"]],
  ];
  for (const [key, color] of CATEGORY_COLOR) {
    expr.push(key, color);
  }
  expr.push("#8b5cf6"); // default
  return expr;
}

export default function NearbyPOILayer({ map }: Props) {
  const { nearbyPOIs, setSelectedPOI, isNavigating } = useMapStore();
  const nearbyPOIsRef = useRef(nearbyPOIs);
  useLayoutEffect(() => {
    nearbyPOIsRef.current = nearbyPOIs;
  });

  useEffect(() => {
    if (!map) return;

    const init = () => {
      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 16,
          clusterRadius: 60,
        });
      }

      if (!map.getLayer(LAYER_CLUSTER)) {
        map.addLayer({
          id: LAYER_CLUSTER,
          type: "circle",
          source: SOURCE,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#3b82f6",
              10,
              "#2563eb",
              30,
              "#1d4ed8",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              15,
              10,
              20,
              30,
              25,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
          },
        });
      }

      if (!map.getLayer(LAYER_CLUSTER_COUNT)) {
        map.addLayer({
          id: LAYER_CLUSTER_COUNT,
          type: "symbol",
          source: SOURCE,
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });
      }

      if (!map.getLayer(LAYER_GLOW)) {
        map.addLayer({
          id: LAYER_GLOW,
          type: "circle",
          source: SOURCE,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 22,
            "circle-color": categoryColor(),
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
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              6,
              15,
              11,
            ],
            "circle-color": categoryColor(),
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
          filter: ["!", ["has", "point_count"]],
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

      const pois = nearbyPOIsRef.current;
      if (pois.length) {
        (map.getSource(SOURCE) as mapboxgl.GeoJSONSource)?.setData(
          buildGeojson(pois),
        );
      }
    };

    const handleDotClick = (
      e: mapboxgl.MapMouseEvent & {
        features?: mapboxgl.MapboxGeoJSONFeature[];
      },
    ) => {
      const f = e.features?.[0];
      if (!f) return;
      const { name, category, address, lat, lng, fsqId, photo, distance } =
        f.properties as {
          name: string;
          category: string;
          address: string;
          lat: number;
          lng: number;
          fsqId: string;
          photo: string;
          distance: number;
        };
      setSelectedPOI({
        name,
        category,
        address,
        distance,
        location: { lng, lat },
        fsqId,
        photo: photo || null,
      });
    };

    const handleClusterClick = (
      e: mapboxgl.MapMouseEvent & {
        features?: mapboxgl.MapboxGeoJSONFeature[];
      },
    ) => {
      const f = e.features?.[0];
      if (!f) return;
      const src = map.getSource(SOURCE) as mapboxgl.GeoJSONSource;
      src.getClusterExpansionZoom(
        f.properties!.cluster_id as number,
        (err, zoom) => {
          if (err) return;
          const coords = (f.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          map.easeTo({ center: coords, zoom: zoom! });
        },
      );
    };

    init();
    map.on("style.load", init);
    map.on("click", LAYER_DOT, handleDotClick);
    map.on("click", LAYER_CLUSTER, handleClusterClick);
    map.on("mouseenter", LAYER_DOT, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_DOT, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", LAYER_CLUSTER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_CLUSTER, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.off("style.load", init);
      map.off("click", LAYER_DOT, handleDotClick);
      map.off("click", LAYER_CLUSTER, handleClusterClick);
    };
  }, [map, setSelectedPOI]);

  useEffect(() => {
    if (!map) return;
    const src = map.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(isNavigating ? buildGeojson([]) : buildGeojson(nearbyPOIs));
  }, [map, nearbyPOIs, isNavigating]);

  return null;
}

function buildGeojson(pois: NearbyPOI[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pois.map((poi) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [poi.lng, poi.lat] },
      properties: {
        name: poi.name,
        category: poi.category,
        address: poi.address,
        distance: poi.distance,
        lat: poi.lat,
        lng: poi.lng,
        fsqId: poi.fsqId,
        photo: poi.photo ?? "",
      },
    })),
  };
}
