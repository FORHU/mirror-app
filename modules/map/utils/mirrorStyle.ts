import mapboxgl from "mapbox-gl";

export function applyMirrorStyle(map: mapboxgl.Map): void {
  const style = map.getStyle();
  if (!style || !style.layers) return;

  style.layers.forEach((layer) => {
    // Background
    if (layer.id === 'background') {
      map.setPaintProperty(layer.id, 'background-color', '#000000');
    }

    // Land and landuse
    if (layer.id.includes('land') || layer.id.includes('landuse')) {
      if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', '#0a0a0a');
      }
    }

    // Water
    if (layer.id.includes('water')) {
      if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', '#0d1117');
      }
    }

    // Parks
    if (layer.id.includes('park') || layer.id.includes('national-park')) {
      if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', '#0a0f0a');
      }
    }

    // Buildings
    if (layer.id.includes('building')) {
      if (layer.type === 'fill-extrusion') {
        map.setPaintProperty(layer.id, 'fill-extrusion-color', '#141414');
        map.setPaintProperty(layer.id, 'fill-extrusion-opacity', 0.35);
      } else if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', '#111111');
        map.setPaintProperty(layer.id, 'fill-opacity', 0.5);
      }
    }

    // Roads
    if (layer.id.includes('tunnel') || layer.id.includes('road') || layer.id.includes('bridge')) {
      if (layer.type === 'line') {
        const id = layer.id;
        if (id.includes('motorway')) {
          map.setPaintProperty(id, 'line-color', '#2a2a2a');
          map.setPaintProperty(id, 'line-opacity', 0.9);
        } else if (id.includes('primary')) {
          map.setPaintProperty(id, 'line-color', '#222222');
          map.setPaintProperty(id, 'line-opacity', 0.85);
        } else if (id.includes('secondary')) {
          map.setPaintProperty(id, 'line-color', '#1c1c1c');
          map.setPaintProperty(id, 'line-opacity', 0.8);
        } else {
          map.setPaintProperty(id, 'line-color', '#161616');
          map.setPaintProperty(id, 'line-opacity', 0.7);
        }
      }
    }

    // Road Labels
    if (layer.type === 'symbol' && layer.id.includes('label')) {
      map.setPaintProperty(layer.id, 'text-color', '#999999');
      map.setPaintProperty(layer.id, 'text-opacity', 0.95);
      map.setPaintProperty(layer.id, 'text-halo-color', '#000000');
      map.setPaintProperty(layer.id, 'text-halo-width', 2);
    }

    // POI
    if (layer.id.includes('poi')) {
      if (layer.type === 'symbol') {
        map.setPaintProperty(layer.id, 'icon-opacity', 0.4);
        map.setPaintProperty(layer.id, 'text-color', '#888888');
        map.setPaintProperty(layer.id, 'text-opacity', 0.8);
        map.setPaintProperty(layer.id, 'text-halo-color', '#000000');
        map.setPaintProperty(layer.id, 'text-halo-width', 1);
      }
    }
  });
}

export function applyStandardStyle(map: mapboxgl.Map): void {
  map.setStyle('mapbox://styles/mapbox/dark-v11');
}
