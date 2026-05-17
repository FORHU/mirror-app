import mapboxgl from "mapbox-gl";

export function applyMirrorStyle(map: mapboxgl.Map): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  style.layers.forEach((layer) => {
    if (layer.id === "background") {
      map.setPaintProperty(layer.id, "background-opacity", 0);
    }

    // All fills — transparent
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-opacity", 0);
    }

    // 3D buildings
    if (layer.type === "fill-extrusion") {
      map.setPaintProperty(layer.id, "fill-extrusion-color", "#ffffff");
      map.setPaintProperty(layer.id, "fill-extrusion-opacity", 0.2);
    }

    // Roads
    if (
      (layer.id.includes("tunnel") || layer.id.includes("road") || layer.id.includes("bridge")) &&
      layer.type === "line"
    ) {
      if (layer.id.includes("motorway") || layer.id.includes("primary")) {
        map.setPaintProperty(layer.id, "line-color", "#ffffff");
        map.setPaintProperty(layer.id, "line-opacity", 0.55);
      } else if (layer.id.includes("secondary") || layer.id.includes("tertiary")) {
        map.setPaintProperty(layer.id, "line-color", "#ffffff");
        map.setPaintProperty(layer.id, "line-opacity", 0.35);
      } else {
        map.setPaintProperty(layer.id, "line-color", "#ffffff");
        map.setPaintProperty(layer.id, "line-opacity", 0.15);
      }
    }

    // Labels — high contrast with strong dark halo
    if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", "#ffffff");
      map.setPaintProperty(layer.id, "text-opacity", 1);
      map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.85)");
      map.setPaintProperty(layer.id, "text-halo-width", 2.5);
    }
  });
}

export function applyStandardStyle(map: mapboxgl.Map): void {
  map.setStyle("mapbox://styles/mapbox/dark-v11");
}
