"use client";

import React, { useEffect, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMap } from "./MapProvider";
import { useMapStore } from "../store/useMapStore";
import { MAPBOX_TOKEN, INITIAL_VIEW_STATE, MAP_STYLES } from "../constants/config";
import { applyMirrorStyle } from "../utils/mirrorStyle";
import { useTheme } from "next-themes";
import turfBearing from "@turf/bearing";
import { point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";

interface MapViewportProps {
  className?: string;
}

export const MapViewport: React.FC<MapViewportProps> = React.memo(({ className }) => {
  const { map, setMap, mapContainerRef } = useMap();
  const {
    userLocation, setUserLocation, isNavigating, cameraBearing, deviceType,
    updateNavigationProgress, setGpsStatus, activeRoute
  } = useMapStore();
  const lastLocationRef = React.useRef<[number, number] | null>(null);
  const hasCenteredRef = React.useRef(false);
  const { resolvedTheme } = useTheme();

  const mapStyle = useMemo(() => {
    return resolvedTheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light;
  }, [resolvedTheme]);

  const cameraRef = React.useRef({
    bearing: INITIAL_VIEW_STATE.bearing,
    pitch: INITIAL_VIEW_STATE.pitch,
    zoom: INITIAL_VIEW_STATE.zoom
  });

  const puckRef = React.useRef<mapboxgl.Marker | null>(null);
  const puckModeRef = React.useRef<boolean | null>(null);
  const destMarkerRef = React.useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: cameraRef.current.zoom,
      pitch: cameraRef.current.pitch,
      bearing: cameraRef.current.bearing,
      antialias: true,
    });

    mapInstance.on('moveend', () => {
      cameraRef.current = {
        bearing: mapInstance.getBearing(),
        pitch: mapInstance.getPitch(),
        zoom: mapInstance.getZoom()
      };
    });

    mapInstance.on("load", () => {
      applyMirrorStyle(mapInstance);
      setMap(mapInstance);
      useMapStore.getState().setMap(mapInstance);
      
      const { showTraffic, showTerrain } = useMapStore.getState();
      try {
        if (showTraffic) mapInstance.setConfigProperty('basemap', 'showTraffic', true);
        if (!showTerrain) mapInstance.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
      } catch (e) {
        console.warn("Skipping basemap config (non-standard style loaded).");
      }

      // Setup POI Interactions using global click to catch all POI layers
      mapInstance.on('click', (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);
        console.log("Clicked features:", features.map(f => ({ name: f.properties?.name, layerId: f.layer?.id, type: f.layer?.type })));
        
        // Find the first feature with a name property that isn't a road, building, or background
        const feature = features.find(f => {
           if (!f.properties?.name) return false;
           const id = f.layer?.id || '';
           if (id.includes('road') || id.includes('building') || id.includes('water') || id.includes('land') || id.includes('admin') || id.includes('block')) return false;
           return true;
        });
        
        if (feature) {
          const name = feature.properties?.name;
          const category = feature.properties?.class || feature.properties?.type || feature.properties?.maki || 'Place';
          // If geometry is Point, use coordinates. Otherwise, use the clicked point.
          let coordinates = [e.lngLat.lng, e.lngLat.lat];
          if (feature.geometry.type === 'Point') {
            coordinates = (feature.geometry as any).coordinates;
          }
          
          if (name) {
            useMapStore.getState().setSelectedPOI({
              name,
              category,
              coordinates: coordinates as [number, number]
            });
            
            mapInstance.easeTo({ center: coordinates as [number, number] });
          }
        }
      });

      mapInstance.on('mousemove', (e) => {
        const features = mapInstance.queryRenderedFeatures(e.point);
        const isHoveringPOI = features.some(f => {
           if (!f.properties?.name) return false;
           const id = f.layer?.id || '';
           if (id.includes('road') || id.includes('building') || id.includes('water') || id.includes('land') || id.includes('admin') || id.includes('block')) return false;
           return true;
        });
        mapInstance.getCanvas().style.cursor = isHoveringPOI ? 'pointer' : '';
      });

    });

    return () => {
      mapInstance.remove();
      setMap(null);
      useMapStore.getState().setMap(null);
    };
  }, [mapContainerRef, setMap, mapStyle]);

  const { destination } = useMapStore();

  // Navigation Slewing Effect
  useEffect(() => {
    if (!map || !destination || isNavigating) return;

    const flyToDestination = () => {
      map.easeTo({
        center: destination.center,
        zoom: 16,
        duration: 3000,
        essential: true
      });
    };

    if (map.isStyleLoaded()) flyToDestination();
    else map.once("style.load", flyToDestination);
  }, [map, destination]);

  // User Location Marker Effect
  useEffect(() => {
    const rawLocation = userLocation || activeRoute?.routes[0].geometry.coordinates[0] as [number, number] | undefined;
    if (!map || !rawLocation) {
      if (puckRef.current) {
        puckRef.current.remove();
        puckRef.current = null;
      }
      return;
    }

    // Snap puck to nearest point on route during navigation so it stays on the line
    let displayLocation: [number, number] = rawLocation;
    if (isNavigating && activeRoute && userLocation) {
      const routeLine = activeRoute.routes[0].geometry;
      const nearest = nearestPointOnLine(routeLine, point(userLocation), { units: 'meters' });
      displayLocation = nearest.geometry.coordinates as [number, number];
    }

    const modeChanged = puckModeRef.current !== isNavigating;
    puckModeRef.current = isNavigating;

    if (modeChanged && puckRef.current) {
      puckRef.current.remove();
      puckRef.current = null;
    }

    if (!puckRef.current) {
      const el = document.createElement('div');

      if (isNavigating) {
        el.className = 'navigation-puck';
        el.innerHTML = `
          <div style="filter: drop-shadow(0 0 6px rgba(79, 195, 247, 0.6));">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32 8L52 52L32 44L12 52L32 8Z" stroke="white" stroke-width="4" stroke-linejoin="round"/>
            </svg>
          </div>
        `;
        puckRef.current = new mapboxgl.Marker({
          element: el,
          rotationAlignment: 'map',
          pitchAlignment: 'map'
        })
        .setLngLat(displayLocation)
        .addTo(map);
      } else {
        el.className = 'explore-pin';
        el.innerHTML = `
          <div style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3)); width: 28px; height: 28px; background-color: white; border: 4px solid var(--ghost-panel-border); border-radius: 50%;">
          </div>
        `;
        puckRef.current = new mapboxgl.Marker({
          element: el,
          rotationAlignment: 'viewport',
          pitchAlignment: 'viewport'
        })
        .setLngLat(displayLocation)
        .addTo(map);
      }
    } else {
      puckRef.current.setLngLat(displayLocation);
      if (isNavigating) {
        puckRef.current.setRotation(cameraBearing);
      }
    }
  }, [map, userLocation, activeRoute, isNavigating, cameraBearing]);

  // Destination Pin Effect
  useEffect(() => {
    if (!map) return;
    if (!destination) {
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      return;
    }

    if (!destMarkerRef.current) {
      destMarkerRef.current = new mapboxgl.Marker({ color: "#ef4444", scale: 1.2 })
      .setLngLat(destination.center)
      .addTo(map);
    } else {
      destMarkerRef.current.setLngLat(destination.center);
    }
  }, [map, destination]);

  // Reactive Layer Controls
  useEffect(() => {
    if (!map) return;
    try {
      const { showTraffic, showTerrain } = useMapStore.getState();
      map.setConfigProperty('basemap', 'showTraffic', showTraffic);
      map.setConfigProperty('basemap', 'showPointOfInterestLabels', showTerrain);
    } catch (e) {
      console.warn("Mapbox Config Error:", e);
    }
  }, [map, useMapStore(state => state.showTraffic), useMapStore(state => state.showTerrain)]);

  // Persistent GPS tracking — starts when map is ready, not just during navigation.
  // First fix centers the map and sets the route origin. Navigation updates piggyback on the same watch.
  useEffect(() => {
    if (!map || deviceType !== 'phone' || !("geolocation" in navigator)) return;

    hasCenteredRef.current = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus('good');
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        const speed = position.coords.speed;
        let heading = position.coords.heading;

        if ((heading === null || (speed !== null && speed < 2)) && lastLocationRef.current) {
          heading = turfBearing(point(lastLocationRef.current), point(coords));
        }

        setUserLocation(coords);
        lastLocationRef.current = coords;

        // On first fix: center map and re-fetch route if destination already picked
        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true;
          map.jumpTo({
            center: coords,
            zoom: INITIAL_VIEW_STATE.zoom,
            pitch: INITIAL_VIEW_STATE.pitch,
            bearing: INITIAL_VIEW_STATE.bearing
          });
          const { destination } = useMapStore.getState();
          if (destination) useMapStore.getState().fetchRoute(true);
        }

        const { isNavigating } = useMapStore.getState();
        if (isNavigating) {
          updateNavigationProgress(coords, speed, heading);
        }
      },
      (error) => {
        console.error("GPS Watch Error:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('lost');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map, deviceType]);

  return (
    <div 
      ref={mapContainerRef} 
      className={`w-full h-full ${className || ""}`}
      style={{ position: "absolute", inset: 0 }}
    />
  );
});

MapViewport.displayName = "MapViewport";
