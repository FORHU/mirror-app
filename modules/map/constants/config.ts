export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const INITIAL_VIEW_STATE = {
  longitude: -0.0865,
  latitude: 51.5048,
  zoom: 16,
  pitch: 60,
  bearing: -17.6,
};

export const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/standard",
  light: "mapbox://styles/mapbox/standard",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export const CINEMATIC_CONFIG = {
  rotationSpeed: 0.1, // degrees per frame
  flyInDuration: 4000, // ms
  idleDelay: 10000, // ms before idle rotation starts
};
