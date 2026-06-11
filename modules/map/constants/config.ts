export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export const INITIAL_VIEW_STATE = {
  longitude: 120.5933,
  latitude: 16.4089,
  zoom: 16.5,
  pitch: 0,
  bearing: 0,
};

export const MAP_STYLES = {
  standard: "mapbox://styles/mapbox/standard",
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export const CINEMATIC_CONFIG = {
  rotationSpeed: 0.1, // degrees per frame
  flyInDuration: 4000, // ms
  idleDelay: 10000, // ms before idle rotation starts
};
