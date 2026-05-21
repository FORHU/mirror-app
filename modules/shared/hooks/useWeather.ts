"use client";

import { useEffect, useState } from 'react';

export interface WeatherData {
  temp: number | null;
  city: string;
  code: number;
}

const COORDS_KEY = 'mirror_weather_coords';
const COORDS_TTL = 12 * 60 * 60 * 1000; // 12 hours

interface CachedCoords {
  lat: number;
  lon: number;
  at: number;
}

function readCachedCoords(): CachedCoords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const cached: CachedCoords = JSON.parse(raw);
    if (Date.now() - cached.at > COORDS_TTL) {
      localStorage.removeItem(COORDS_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCoords(lat: number, lon: number) {
  try {
    localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon, at: Date.now() }));
  } catch {}
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function fetchWithCoords(lat: number, lon: number) {
      fetch(`/api/weather?lat=${lat}&lon=${lon}`)
        .then(r => r.json())
        .then((d: WeatherData) => setWeather(d))
        .catch(() => setWeather({ temp: null, code: 0, city: '---' }))
        .finally(() => setLoading(false));
    }

    function fetchFromServer() {
      fetch('/api/weather')
        .then(r => r.json())
        .then((d: WeatherData) => setWeather(d))
        .catch(() => setWeather({ temp: null, code: 0, city: '---' }))
        .finally(() => setLoading(false));
    }

    function fallback() {
      // Geolocation denied or unavailable — use cached coords if still fresh
      const cached = readCachedCoords();
      if (cached) {
        fetchWithCoords(cached.lat, cached.lon);
      } else {
        fetchFromServer(); // last resort: server-side IP geo
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          writeCoords(coords.latitude, coords.longitude);
          fetchWithCoords(coords.latitude, coords.longitude);
        },
        fallback,
        // enableHighAccuracy forces GPS/WiFi positioning instead of IP geo.
        // maximumAge:0 prevents the browser from returning a stale IP-based fix.
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    } else {
      fallback();
    }
  }, []);

  return { weather, loading };
}
