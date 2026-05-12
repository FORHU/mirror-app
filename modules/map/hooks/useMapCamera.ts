"use client";

import { useEffect, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import mapboxgl from "mapbox-gl";
import { point } from "@turf/helpers";
import distance from "@turf/distance";
import nearestPointOnLine from "@turf/nearest-point-on-line";

export const useMapCamera = () => {
  const {
    map, isNavigating, userLocation, activeRoute,
    cameraMode, remainingDistance, deviceType, gpsStatus
  } = useMapStore();
  
  const lastCoordsRef = useRef<[number, number] | null>(null);
  const lastBearingRef = useRef<number>(0);
  const isTransitioningRef = useRef(false);

  // User's provided bearing logic
  const calculateBearing = (prev: [number, number], curr: [number, number]): number => {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    const dLng = toRad(curr[0] - prev[0]);
    const lat1 = toRad(prev[1]);
    const lat2 = toRad(curr[1]);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const lerpBearing = (current: number, target: number, factor: number): number => {
    let delta = ((target - current + 540) % 360) - 180;
    return current + delta * factor;
  };

  // Helper to find point at distance along route
  const getPointAtDistance = (line: any, dist: number): [number, number] => {
    const coords = line.coordinates;
    let accumulated = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i+1];
      const d = distance(point(p1), point(p2), { units: 'meters' });
      if (accumulated + d >= dist) {
        const remaining = dist - accumulated;
        const ratio = remaining / d;
        return [
          p1[0] + (p2[0] - p1[0]) * ratio,
          p1[1] + (p2[1] - p1[1]) * ratio
        ];
      }
      accumulated += d;
    }
    return coords[coords.length - 1];
  };

  // 1. Initial Transition on Start Navigation — only fires when isNavigating flips to true
  useEffect(() => {
    if (!isNavigating || !map || !activeRoute) return;

    // Read location from store directly so GPS updates don't re-trigger this effect
    const { origin, userLocation: currentLoc } = useMapStore.getState();
    const startLoc = currentLoc || origin;
    if (!startLoc) return;

    isTransitioningRef.current = true;

    const route = activeRoute.routes[0];
    const startCoord = route.geometry.coordinates[0];
    const nextCoord = route.geometry.coordinates[1];
    const initialBearing = calculateBearing(startCoord, nextCoord);

    map.stop();
    map.flyTo({
      center: startLoc,
      zoom: 20,
      pitch: 60,
      bearing: initialBearing,
      duration: 2200,
      essential: true,
      easing: (t: number) => t * (2 - t)
    });

    map.once('moveend', () => {
      isTransitioningRef.current = false;
      lastBearingRef.current = initialBearing;
      useMapStore.getState().setCameraMode('follow');
    });
  }, [isNavigating, map, activeRoute]);

  // 2. Continuous Follow Logic
  useEffect(() => {
    if (!isNavigating || !map || cameraMode !== 'follow' || isTransitioningRef.current) return;
    if (gpsStatus === 'lost' && deviceType === 'phone') return;

    let targetLocation: [number, number] | null = null;
    let targetBearing: number | null = null;

    if (deviceType === 'mirror' && activeRoute) {
      const routeLine = activeRoute.routes[0].geometry;
      const totalDist = activeRoute.routes[0].distance;
      const progress = Math.max(0, totalDist - remainingDistance);
      
      targetLocation = getPointAtDistance(routeLine, progress);
      const lookAhead = getPointAtDistance(routeLine, progress + 10);
      targetBearing = calculateBearing(targetLocation, lookAhead);
    } else if (userLocation && activeRoute) {
      const routeLine = activeRoute.routes[0].geometry;
      const nearest = nearestPointOnLine(routeLine, point(userLocation), { units: 'meters' });
      targetLocation = nearest.geometry.coordinates as [number, number];

      // Use remainingDistance (already tracked in store) to find progress
      // along the route and look 30 m ahead — no deprecated turf properties.
      const totalDist = activeRoute.routes[0].distance;
      const progress = Math.max(0, totalDist - remainingDistance);
      const lookAhead = getPointAtDistance(routeLine, progress + 30);
      targetBearing = calculateBearing(targetLocation, lookAhead);
    }

    if (targetLocation) {
      if (targetBearing !== null) {
        const smoothedBearing = lerpBearing(lastBearingRef.current, targetBearing, 0.25);
        lastBearingRef.current = smoothedBearing;
        
        map.easeTo({
          center: targetLocation,
          bearing: smoothedBearing,
          pitch: 60,
          zoom: 20,
          duration: 1000,
          essential: true,
          easing: (t: number) => t
        });
        
        useMapStore.setState({ cameraBearing: smoothedBearing });
      } else {
        map.easeTo({
          center: targetLocation,
          pitch: 60,
          zoom: 20,
          duration: 1000,
          essential: true,
          easing: (t: number) => t
        });
      }
      
      lastCoordsRef.current = targetLocation;
    }
  }, [isNavigating, userLocation, remainingDistance, cameraMode, map, deviceType, gpsStatus]);

  // 3. Overview Mode Handling
  useEffect(() => {
    if (isNavigating && map && cameraMode === 'overview' && activeRoute) {
      const routeLine = activeRoute.routes[0].geometry;
      const coordinates = routeLine.coordinates;
      const bounds = coordinates.reduce((acc: any, coord: any) => acc.extend(coord), new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
      
      map.fitBounds(bounds, {
        padding: 80,
        pitch: 45,
        bearing: 0,
        duration: 1000
      });
    }
  }, [cameraMode, isNavigating, map, activeRoute]);

  // 4. Mirror Mode Simulation Loop
  useEffect(() => {
    if (!isNavigating || deviceType !== 'mirror' || !activeRoute) return;

    const SIMULATED_SPEED_MPS = 15; // ~33 mph
    const INTERVAL_MS = 1000;

    const interval = setInterval(() => {
      const { remainingDistance, updateNavigationProgress, setUserLocation } = useMapStore.getState();
      
      if (remainingDistance <= 0) {
        clearInterval(interval);
        return;
      }

      const newRemainingDist = Math.max(0, remainingDistance - SIMULATED_SPEED_MPS);
      const routeLine = activeRoute.routes[0].geometry;
      const totalDist = activeRoute.routes[0].distance;
      const progress = totalDist - newRemainingDist;
      
      const currentPos = getPointAtDistance(routeLine, progress);
      const nextPos = getPointAtDistance(routeLine, progress + 5);
      const heading = calculateBearing(currentPos, nextPos);

      // Update store so puck and camera follow
      setUserLocation(currentPos);
      useMapStore.setState({ userBearing: heading });
      updateNavigationProgress(currentPos, SIMULATED_SPEED_MPS, heading);
      
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isNavigating, deviceType, activeRoute]);

  // 5. Reset on Stop
  useEffect(() => {
    if (!isNavigating && map) {
      map.flyTo({
        pitch: 0,
        bearing: 0,
        zoom: 14,
        duration: 1500,
        easing: (t: number) => t * (2 - t)
      });
      lastCoordsRef.current = null;
    }
  }, [isNavigating, map]);

  return null;
};
