"use client";

import { useEffect, useState, type ComponentType } from "react";
import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { getWeather, type WeatherCache } from "@/modules/shared/utils/weather";

interface Props {
  location: { lat: number; lng: number } | null;
}

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

const WeatherWidget = ({ location }: Props) => {
  const [weather, setWeather] = useState<WeatherCache | null>(null);
  const lat = location?.lat;
  const lng = location?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;

    let cancelled = false;
    const load = async () => {
      const data = await getWeather(lat, lng);
      if (!cancelled) setWeather(data);
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lat, lng]);

  if (!weather) return null;

  const IconComponent =
    (Icons as unknown as Record<string, ComponentType<LucideProps>>)[
      weather.icon
    ] || Icons.Cloud;

  return (
    <div className="flex items-center gap-4 text-white p-4">
      <IconComponent
        className="w-8 h-8 text-(--hud-icon-stroke)"
        style={{ filter: "drop-shadow(var(--hud-text-shadow))" }}
      />
      <div className="flex flex-col">
        <span
          className="text-3xl font-light leading-none"
          style={{ textShadow: "var(--hud-text-shadow)" }}
        >
          {Math.round(weather.temperature)}°
        </span>
        <span
          className="text-xs text-white/50 uppercase tracking-widest mt-1"
          style={{ textShadow: "var(--hud-text-shadow)" }}
        >
          {weather.condition}
        </span>
      </div>
    </div>
  );
};

export default WeatherWidget;
