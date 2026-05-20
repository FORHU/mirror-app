"use client";

import { useEffect, useState } from 'react';

export interface WeatherData {
  temp: number;
  city: string;
  code: number;
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        // IP-based location — no permission required, works on HTTP
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        const { latitude: lat, longitude: lon, city } = ipData;

        const meteoRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`,
        );
        const meteo = await meteoRes.json();

        setWeather({
          temp: Math.round(meteo.current.temperature_2m),
          code: meteo.current.weather_code,
          city: city ?? 'Unknown',
        });
      } catch {
        // silently fail — widget stays hidden
      } finally {
        setLoading(false);
      }
    }
    fetchWeather();
  }, []);

  return { weather, loading };
}
