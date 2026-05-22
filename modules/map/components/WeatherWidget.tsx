"use client";

import React, { useEffect, useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { API_URL } from "@/modules/shared/config/device.config";
import * as Icons from "lucide-react";

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  windspeed: number;
  humidity: number;
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const homeLocation = useMapStore((state) => state.homeLocation);

  const fetchWeather = async () => {
    if (!homeLocation) return;
    try {
      const res = await fetch(`${API_URL}/api/mirror/weather?lat=${homeLocation.lat}&lng=${homeLocation.lng}`);
      const data = await res.json();
      setWeather(data);
    } catch (err) {
      console.error("Failed to fetch weather:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchWeather is stable within this component scope
  }, [homeLocation]);

  if (!weather) return null;

  const IconComponent = (Icons as unknown as Record<string, typeof Icons.Cloud>)[weather.icon] || Icons.Cloud;

  return (
    <div className="flex items-center gap-4 text-white p-4">
      <IconComponent className="w-8 h-8 text-(--hud-icon-stroke)" style={{ filter: 'drop-shadow(var(--hud-text-shadow))' }} />
      <div className="flex flex-col">
        <span className="text-3xl font-light leading-none" style={{ textShadow: 'var(--hud-text-shadow)' }}>
          {Math.round(weather.temperature)}°
        </span>
        <span className="text-xs text-white/50 uppercase tracking-widest mt-1" style={{ textShadow: 'var(--hud-text-shadow)' }}>
          {weather.condition}
        </span>
      </div>
    </div>
  );
};

export default WeatherWidget;
