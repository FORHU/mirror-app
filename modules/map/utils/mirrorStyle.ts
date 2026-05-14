import mapboxgl from "mapbox-gl";

export function applyMirrorStyle(map: mapboxgl.Map): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    if (layer.id === "background") {
      map.setPaintProperty(layer.id, "background-color", "#000000");
    }
    if ((layer.id.includes("land") || layer.id.includes("landuse")) && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#0a0a0a");
    }
    if (layer.id.includes("water") && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#0d1117");
    }
    if ((layer.id.includes("park") || layer.id.includes("national-park")) && layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-color", "#0a0f0a");
    }
    if (layer.id.includes("building")) {
      if (layer.type === "fill-extrusion") {
        map.setPaintProperty(layer.id, "fill-extrusion-color", "#141414");
        map.setPaintProperty(layer.id, "fill-extrusion-opacity", 0.35);
      } else if (layer.type === "fill") {
        map.setPaintProperty(layer.id, "fill-color", "#111111");
        map.setPaintProperty(layer.id, "fill-opacity", 0.5);
      }
    }
    if (
      (layer.id.includes("tunnel") || layer.id.includes("road") || layer.id.includes("bridge")) &&
      layer.type === "line"
    ) {
      if (layer.id.includes("motorway")) {
        map.setPaintProperty(layer.id, "line-color", "#2a2a2a");
        map.setPaintProperty(layer.id, "line-opacity", 0.9);
      } else if (layer.id.includes("primary")) {
        map.setPaintProperty(layer.id, "line-color", "#222222");
        map.setPaintProperty(layer.id, "line-opacity", 0.85);
      } else if (layer.id.includes("secondary")) {
        map.setPaintProperty(layer.id, "line-color", "#1c1c1c");
        map.setPaintProperty(layer.id, "line-opacity", 0.8);
      } else {
        map.setPaintProperty(layer.id, "line-color", "#161616");
        map.setPaintProperty(layer.id, "line-opacity", 0.7);
      }
    }
    if (layer.type === "symbol" && layer.id.includes("label")) {
      map.setPaintProperty(layer.id, "text-color", "#999999");
      map.setPaintProperty(layer.id, "text-opacity", 0.95);
      map.setPaintProperty(layer.id, "text-halo-color", "#000000");
      map.setPaintProperty(layer.id, "text-halo-width", 2);
    }
  });
}

export function applyStandardStyle(map: mapboxgl.Map): void {
  map.setStyle("mapbox://styles/mapbox/dark-v11");
}
