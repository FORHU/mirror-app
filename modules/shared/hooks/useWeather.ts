"use client";

import { useEffect, useState } from "react";

export interface WeatherData {
  temp: number | null;
  city: string;
  code: number;
  condition?: string;
}

const COORDS_KEY = "mirror_weather_coords";
const COORDS_TTL = 12 * 60 * 60 * 1000; // 12 hours

// Weather barely changes minute to minute, and useWeather is mounted by
// several components at once (header widget, page, VoiceProvider). A
// module-level cache lets the first caller fetch and everyone else share
// the result — one network request per TTL window instead of one per mount.
const WEATHER_TTL = 10 * 60 * 1000; // 10 minutes

interface CachedCoords {
  lat: number;
  lon: number;
  at: number;
}

interface WeatherResult {
  weather: WeatherData;
  coords: { lat: number; lon: number } | null;
}

let cachedWeather: (WeatherResult & { at: number }) | null = null;
let inflightWeather: Promise<WeatherResult> | null = null;

function readCachedCoords(): CachedCoords | null {
  try {
    const raw = sessionStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const cached: CachedCoords = JSON.parse(raw);
    if (Date.now() - cached.at > COORDS_TTL) {
      sessionStorage.removeItem(COORDS_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCoords(lat: number, lon: number) {
  try {
    sessionStorage.setItem(
      COORDS_KEY,
      JSON.stringify({ lat, lon, at: Date.now() }),
    );
  } catch {}
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 21) return "Evening";
  return "Night";
}

function fallbackWeather(): WeatherData {
  return { temp: null, code: 0, city: "---", condition: getTimeOfDay() };
}

function normalizeWeather(raw: unknown, fallbackCity = "---"): WeatherData {
  const d =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const temp =
    typeof d.temp === "number"
      ? d.temp
      : typeof d.temperature === "number"
        ? Math.round(d.temperature)
        : null;
  const code =
    typeof d.code === "number"
      ? d.code
      : typeof d.weather_code === "number"
        ? d.weather_code
        : 0;
  const city = typeof d.city === "string" ? d.city : fallbackCity;
  const condition = typeof d.condition === "string" ? d.condition : undefined;
  return { temp, code, city, condition };
}

async function fetchWithCoords(lat: number, lon: number): Promise<WeatherData> {
  try {
    const r = await fetch(`/api/mirror/weather?lat=${lat}&lng=${lon}`);
    return normalizeWeather(await r.json());
  } catch {
    try {
      const r = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      return normalizeWeather(await r.json());
    } catch {
      return fallbackWeather();
    }
  }
}

async function fetchFromServer(): Promise<WeatherData> {
  try {
    const r = await fetch("/api/weather");
    return normalizeWeather(await r.json());
  } catch {
    return fallbackWeather();
  }
}

function getPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
      () => resolve(null),
      // enableHighAccuracy forces GPS/WiFi positioning instead of IP geo.
      // maximumAge:0 prevents the browser from returning a stale IP-based fix.
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

async function loadWeather(): Promise<WeatherResult> {
  const pos = await getPosition();
  if (pos) {
    writeCoords(pos.lat, pos.lon);
    return { weather: await fetchWithCoords(pos.lat, pos.lon), coords: pos };
  }
  // Geolocation denied or unavailable — use cached coords if still fresh
  const cached = readCachedCoords();
  if (cached) {
    return {
      weather: await fetchWithCoords(cached.lat, cached.lon),
      coords: null,
    };
  }
  return { weather: await fetchFromServer(), coords: null }; // last resort: server-side IP geo
}

function getWeather(): Promise<WeatherResult> {
  if (cachedWeather && Date.now() - cachedWeather.at < WEATHER_TTL) {
    return Promise.resolve(cachedWeather);
  }
  if (!inflightWeather) {
    inflightWeather = loadWeather().then((result) => {
      cachedWeather = { ...result, at: Date.now() };
      inflightWeather = null;
      return result;
    });
  }
  return inflightWeather;
}

export function useWeather() {
  const [state, setState] = useState<{
    weather: WeatherData | null;
    coords: { lat: number; lon: number } | null;
    loading: boolean;
  }>(() =>
    cachedWeather && Date.now() - cachedWeather.at < WEATHER_TTL
      ? {
          weather: cachedWeather.weather,
          coords: cachedWeather.coords,
          loading: false,
        }
      : { weather: null, coords: null, loading: true },
  );

  useEffect(() => {
    let active = true;
    void getWeather().then(({ weather, coords }) => {
      if (active) setState({ weather, coords, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
