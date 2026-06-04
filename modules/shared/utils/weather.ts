import { useMirrorStore, type WeatherCache } from "@/modules/shared/store/useMirrorStore";
export type { WeatherCache };

const WEATHER_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Returns cached weather if still fresh, otherwise fetches from /api/mirror/weather,
 * stores the result in useMirrorStore, and returns it.
 * Returns null on failure (caller should proceed without weather context).
 */
export async function getWeather(
  lat: number,
  lon: number,
): Promise<WeatherCache | null> {
  const cached = useMirrorStore.getState().weatherCache;
  if (cached && Date.now() - cached.fetchedAt < WEATHER_TTL) return cached;

  try {
    const res = await fetch(`/api/mirror/weather?lat=${lat}&lng=${lon}`);
    if (!res.ok) return cached ?? null;
    const json = await res.json();
    const d = json.data ?? json;

    const cache: WeatherCache = {
      temperature: Number(d.temperature ?? 0),
      condition: String(d.condition ?? ""),
      icon: String(d.icon ?? "Sun"),
      windspeed: Number(d.windspeed ?? 0),
      humidity: Number(d.humidity ?? 0),
      precipitationProb: Number(d.precipitationProb ?? 0),
      lat,
      lon,
      date: new Date().toISOString().split("T")[0],
      is_cold: Number(d.temperature) < 20,
      is_hot: Number(d.temperature) >= 30,
      is_rainy:
        Number(d.precipitationProb) >= 50 ||
        String(d.condition ?? "").toLowerCase().includes("rain"),
      fetchedAt: Date.now(),
    };

    useMirrorStore.getState().setWeatherCache(cache);
    return cache;
  } catch {
    return cached ?? null;
  }
}

/** Converts a WeatherCache into the payload shape expected by chatWonderService. */
export function toGarmentWeather(
  cache: WeatherCache | null,
): Record<string, unknown> | undefined {
  if (!cache) return undefined;
  return {
    date: cache.date,
    description: cache.condition.toLowerCase(),
    estimated: false,
    is_cold: cache.is_cold,
    is_hot: cache.is_hot,
    is_rainy: cache.is_rainy,
    lat: cache.lat,
    lon: cache.lon,
    temperature_c: cache.temperature,
  };
}
