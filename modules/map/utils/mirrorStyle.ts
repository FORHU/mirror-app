import mapboxgl from "mapbox-gl";

function isNightTime(): boolean {
  const h = new Date().getHours();
  return h >= 20 || h < 6;
}

export function applyMirrorStyle(map: mapboxgl.Map): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  const night = isNightTime();
  // Day: pure white roads. Night: warm amber-white roads for softer glow.
  const roadColor = night ? "#ffd4a0" : "#ffffff";
  const labelColor = night ? "#fff5e0" : "#ffffff";

  style.layers.forEach((layer) => {
    if (layer.id === "background") {
      map.setPaintProperty(layer.id, "background-opacity", 0);
    }

    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-opacity", 0);
    }

    if (layer.type === "fill-extrusion") {
      map.setPaintProperty(layer.id, "fill-extrusion-color", roadColor);
      map.setPaintProperty(
        layer.id,
        "fill-extrusion-opacity",
        night ? 0.12 : 0.2,
      );
    }

    if (
      (layer.id.includes("tunnel") ||
        layer.id.includes("road") ||
        layer.id.includes("bridge")) &&
      layer.type === "line"
    ) {
      map.setPaintProperty(layer.id, "line-color", roadColor);
      if (layer.id.includes("motorway") || layer.id.includes("primary")) {
        map.setPaintProperty(layer.id, "line-opacity", 0.55);
      } else if (
        layer.id.includes("secondary") ||
        layer.id.includes("tertiary")
      ) {
        map.setPaintProperty(layer.id, "line-opacity", 0.35);
      } else {
        map.setPaintProperty(layer.id, "line-opacity", 0.15);
      }
    }

    if (layer.type === "symbol") {
      map.setPaintProperty(layer.id, "text-color", labelColor);
      map.setPaintProperty(layer.id, "text-opacity", night ? 0.85 : 1);
      map.setPaintProperty(layer.id, "text-halo-color", "rgba(0,0,0,0.85)");
      map.setPaintProperty(layer.id, "text-halo-width", 2.5);
    }
  });
}

export function applyStandardStyle(map: mapboxgl.Map): void {
  map.setStyle("mapbox://styles/mapbox/standard");
}
