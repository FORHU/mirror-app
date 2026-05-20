"use client";

import { useEffect, useState } from 'react';

export interface WeatherData {
  temp: number | null;
  city: string;
  code: number;
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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => fetchWithCoords(coords.latitude, coords.longitude),
        () => fetchFromServer(),    // denied or unavailable → server-side IP geo
        { timeout: 8000 },
      );
    } else {
      fetchFromServer();
    }
  }, []);

  return { weather, loading };
}
