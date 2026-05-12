import mapboxgl from "mapbox-gl";

export const applyMirrorStyle = (map: mapboxgl.Map) => {
  if (!map.getStyle()) return;
  const layers = map.getStyle().layers;
  if (!layers || !Array.isArray(layers)) return;

  layers.forEach((layer) => {
    const id = layer.id;

    // Background
    if (layer.type === "background") {
      map.setPaintProperty(id, "background-color", "#000000");
    }

    // Land / landuse / landcover
    if (
      (id.includes("land") || id.includes("cover") || id.includes("use") || id.includes("area") || id.includes("earth")) &&
      layer.type === "fill" &&
      !id.includes("water") &&
      !id.includes("park") &&
      !id.includes("green") &&
      !id.includes("aeroway")
    ) {
      map.setPaintProperty(id, "fill-color", "#0a0a0a");
      map.setPaintProperty(id, "fill-opacity", 1);
    }

    // Water
    if (id.includes("water") && layer.type === "fill") {
      map.setPaintProperty(id, "fill-color", "#0d1117");
      map.setPaintProperty(id, "fill-opacity", 1);
    }

    // Parks / green areas
    if ((id.includes("park") || id.includes("green") || id.includes("pitch") || id.includes("grass") || id.includes("wood") || id.includes("forest")) && layer.type === "fill") {
      map.setPaintProperty(id, "fill-color", "#0a0f0a");
    }

    // Buildings (fill-extrusion)
    if (id.includes("building") && layer.type === "fill-extrusion") {
      map.setPaintProperty(id, "fill-extrusion-color", "#2a2a2a");
      map.setPaintProperty(id, "fill-extrusion-opacity", 0.7);
      // Keep original height if data-driven, otherwise it stays as is
    }

    // Building footprints / outlines
    if (id.includes("building") && layer.type === "fill") {
      map.setPaintProperty(id, "fill-color", "#111111");
      map.setPaintProperty(id, "fill-opacity", 0.5);
    }
    if (id.includes("building") && layer.type === "line") {
      map.setPaintProperty(id, "line-color", "#1a1a1a");
      map.setPaintProperty(id, "line-opacity", 0.4);
    }

    // Roads
    if (id.includes("road") && layer.type === "line") {
      if (id.includes("case") || id.includes("casing")) {
        map.setPaintProperty(id, "line-color", "#0a0a0a");
        map.setPaintProperty(id, "line-opacity", 0.6);
      } else if (id.includes("motorway") || id.includes("highway") || id.includes("trunk")) {
        map.setPaintProperty(id, "line-color", "#2a2a2a");
        map.setPaintProperty(id, "line-opacity", 0.9);
      } else if (id.includes("primary")) {
        map.setPaintProperty(id, "line-color", "#222222");
        map.setPaintProperty(id, "line-opacity", 0.85);
      } else if (id.includes("secondary") || id.includes("tertiary")) {
        map.setPaintProperty(id, "line-color", "#1c1c1c");
        map.setPaintProperty(id, "line-opacity", 0.8);
      } else if (id.includes("path") || id.includes("track") || id.includes("pedestrian")) {
        map.setPaintProperty(id, "line-color", "#111111");
        map.setPaintProperty(id, "line-opacity", 0.5);
      } else {
        map.setPaintProperty(id, "line-color", "#161616");
        map.setPaintProperty(id, "line-opacity", 0.7);
      }
    }

    // Road labels / street names
    if (id.includes("road") && id.includes("label") && layer.type === "symbol") {
      map.setPaintProperty(id, "text-color", "#b3b3b3");
      map.setPaintProperty(id, "text-opacity", 0.95);
      map.setPaintProperty(id, "text-halo-color", "#000000");
      map.setPaintProperty(id, "text-halo-width", 2);
    }

    // POI labels and icons
    if (id.includes("poi") && layer.type === "symbol") {
      map.setPaintProperty(id, "text-color", "#cccccc");
      map.setPaintProperty(id, "text-opacity", 1);
      map.setPaintProperty(id, "text-halo-color", "#000000");
      map.setPaintProperty(id, "text-halo-width", 2);
    }
    
    // City and neighborhood labels
    if (id.includes("place") && layer.type === "symbol") {
      map.setPaintProperty(id, "text-color", "#e6e6e6");
      map.setPaintProperty(id, "text-opacity", 1);
      map.setPaintProperty(id, "text-halo-color", "#000000");
      map.setPaintProperty(id, "text-halo-width", 2);
    }

    // Transit lines / stops
    if ((id.includes("transit") || id.includes("bus") || id.includes("rail") || id.includes("ferry"))) {
      if (layer.type === "line") {
        map.setPaintProperty(id, "line-color", "#1a1a1a");
        map.setPaintProperty(id, "line-opacity", 0.4);
      } else if (layer.type === "symbol") {
        map.setPaintProperty(id, "icon-opacity", 0.15);
      }
    }

    // Admin / boundary lines
    if ((id.includes("admin") || id.includes("boundary") || id.includes("border")) && layer.type === "line") {
      map.setPaintProperty(id, "line-color", "#1c1c1c");
      map.setPaintProperty(id, "line-opacity", 0.3);
      map.setPaintProperty(id, "line-dasharray", [2, 4]);
    }

    // Aeroway
    if (id.includes("aeroway") || id.includes("airport")) {
      if (layer.type === "fill") {
        map.setPaintProperty(id, "fill-color", "#0d0d0d");
      } else if (layer.type === "line") {
        map.setPaintProperty(id, "line-color", "#181818");
        map.setPaintProperty(id, "line-opacity", 0.3);
      }
    }

    // Tunnel
    if (id.includes("tunnel") && layer.type === "line") {
      map.setPaintProperty(id, "line-color", "#111111");
      map.setPaintProperty(id, "line-opacity", 0.4);
    }
  });

  // dark-v11 does not have 3D buildings by default, so we must manually add them
  if (!map.getLayer("3d-buildings")) {
    const labelLayerId = layers.find(
      (l) => l.type === "symbol" && l.layout && (l.layout as any)["text-field"]
    )?.id;

    map.addLayer(
      {
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#2a2a2a",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.7,
        },
      },
      labelLayerId
    );
  }
};
