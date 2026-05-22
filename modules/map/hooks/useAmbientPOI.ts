"use client";

import { useEffect, useRef, useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { mapService } from "../services/map.service";

export interface AmbientPOI {
  name: string;
  category: string;
  distanceM: number;
  lat: number;
  lng: number;
}

const CATEGORIES = [
  { query: "restaurant",        label: "restaurant" },
  { query: "coffee shop",       label: "coffee shop" },
  { query: "tourist attraction",label: "attraction" },
  { query: "park",              label: "park" },
  { query: "gas station",       label: "gas station" },
  { query: "hotel",             label: "hotel" },
];

const INTERVAL_MS  = 2 * 60 * 1000; // 2 minutes
const MAX_RADIUS_M = 500;

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLng = (b.lng - a.lng) * (Math.PI / 180);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * (Math.PI / 180)) * Math.cos(b.lat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function useAmbientPOI() {
  const [ambientPOI, setAmbientPOI] = useState<AmbientPOI | null>(null);
  const categoryIndexRef = useRef(0);
  const speakingRef = useRef(false);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);

  const speak = async (text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      playbackRef.current?.stop();
      playCtxRef.current?.close();

      const audio = await mapService.tts(text);
      const playCtx = new AudioContext();
      playCtxRef.current = playCtx;

      const decoded = await playCtx.decodeAudioData(audio.slice(0));
      const src = playCtx.createBufferSource();
      src.buffer = decoded;
      src.connect(playCtx.destination);
      playbackRef.current = src;

      src.onended = () => {
        speakingRef.current = false;
        playbackRef.current = null;
        playCtxRef.current?.close();
        playCtxRef.current = null;
      };
      src.start(0);
    } catch {
      speakingRef.current = false;
    }
  };

  const checkNearby = async () => {
    const { isNavigating, userLocation, homeLocation } = useMapStore.getState();
    if (!isNavigating) return;

    const origin = userLocation ?? homeLocation;
    if (!origin) return;

    const cat = CATEGORIES[categoryIndexRef.current % CATEGORIES.length];
    categoryIndexRef.current += 1;

    try {
      const { results } = await mapService.geocode(cat.query, origin);
      const nearby = results
        .map((r) => ({ ...r, distanceM: haversineM(origin, r) }))
        .filter((r) => r.distanceM <= MAX_RADIUS_M)
        .sort((a, b) => a.distanceM - b.distanceM);

      if (!nearby.length) return;

      const pick = nearby[0];
      const distText = pick.distanceM < 100
        ? "just ahead"
        : `about ${Math.round(pick.distanceM / 10) * 10} metres away`;

      setAmbientPOI({ name: pick.name, category: cat.label, distanceM: pick.distanceM, lat: pick.lat, lng: pick.lng });
      speak(`There's a ${cat.label} nearby: ${pick.name}, ${distText}.`);
    } catch {
      // silently ignore geocode failures
    }
  };

  useEffect(() => {
    // Run once after a short delay when navigation starts, then on interval
    const { isNavigating } = useMapStore.getState();
    if (!isNavigating) return;

    const timeout = setTimeout(checkNearby, 15_000); // first check 15s after navigation starts
    const interval = setInterval(checkNearby, INTERVAL_MS);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single subscription on mount; checkNearby uses refs internally
  }, []);

  // Also subscribe to isNavigating to start/stop when navigation changes
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    const unsub = useMapStore.subscribe((state, prev) => {
      if (state.isNavigating && !prev.isNavigating) {
        // Navigation just started
        setAmbientPOI(null);
        categoryIndexRef.current = 0;
        timeout = setTimeout(checkNearby, 15_000);
        interval = setInterval(checkNearby, INTERVAL_MS);
      }
      if (!state.isNavigating && prev.isNavigating) {
        // Navigation stopped
        clearTimeout(timeout);
        clearInterval(interval);
        setAmbientPOI(null);
        playbackRef.current?.stop();
        playCtxRef.current?.close();
        speakingRef.current = false;
      }
    });

    return () => {
      unsub();
      clearTimeout(timeout);
      clearInterval(interval);
      playbackRef.current?.stop();
      playCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single zustand subscription on mount
  }, []);

  const dismissAmbientPOI = () => setAmbientPOI(null);

  return { ambientPOI, dismissAmbientPOI };
}
