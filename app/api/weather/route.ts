import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
type Coords = { lat: number; lon: number };

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const token =
    process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return "Unknown";
  try {
    const d = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=place&limit=1&access_token=${token}`,
    ).then((r) => r.json());
    return d.features?.[0]?.text ?? "Unknown";
  } catch {
    return "Unknown";
  }
}

export async function GET(request: NextRequest) {
  // Priority: .env override → browser-supplied coords → no coords (returns blank)
  const envLat = process.env.WEATHER_LAT ? +process.env.WEATHER_LAT : null;
  const envLon = process.env.WEATHER_LON ? +process.env.WEATHER_LON : null;

  const qLat = request.nextUrl.searchParams.get("lat");
  const qLon = request.nextUrl.searchParams.get("lon");
  const clientLat = qLat ? +qLat : null;
  const clientLon = qLon ? +qLon : null;

  const coords: Coords | null =
    envLat && envLon
      ? { lat: envLat, lon: envLon }
      : clientLat && clientLon
        ? { lat: clientLat, lon: clientLon }
        : null;

  if (!coords) {
    return NextResponse.json({ temp: null, code: 0, city: "---" });
  }

  // Run Mapbox reverse geocoding + Open-Meteo in parallel
  const [city, meteo] = await Promise.allSettled([
    reverseGeocode(coords.lat, coords.lon),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&temperature_unit=celsius`,
      { cache: "no-store" }
    ).then((r) => r.json()),
  ]);

  const cityName = city.status === "fulfilled" ? city.value : "Unknown";
  if (meteo.status === "rejected" || !meteo.value?.current) {
    return NextResponse.json({ temp: null, code: 0, city: cityName });
  }

  const cur = meteo.value.current;
  return NextResponse.json({
    temp: Math.round(cur.temperature_2m),
    code: cur.weather_code,
    city: cityName,
    humidity:
      typeof cur.relative_humidity_2m === "number"
        ? Math.round(cur.relative_humidity_2m)
        : null,
    feelsLike:
      typeof cur.apparent_temperature === "number"
        ? Math.round(cur.apparent_temperature)
        : null,
  });
}
