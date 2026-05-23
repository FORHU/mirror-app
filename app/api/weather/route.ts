import { NextRequest, NextResponse } from "next/server";

type Coords = { lat: number; lon: number };

async function fetchCoords(): Promise<Coords | null> {
  const apis: Array<() => Promise<Coords>> = [
    async () => {
      const d = await fetch("https://freeipapi.com/api/json").then((r) =>
        r.json(),
      );
      if (!d.latitude || !d.longitude) throw new Error("no coords");
      return { lat: +d.latitude, lon: +d.longitude };
    },
    async () => {
      const d = await fetch("https://ipwho.is/").then((r) => r.json());
      if (!d.latitude || !d.longitude) throw new Error("no coords");
      return { lat: +d.latitude, lon: +d.longitude };
    },
    async () => {
      const d = await fetch("https://ip.seeip.org/geoip").then((r) => r.json());
      if (!d.latitude || !d.longitude) throw new Error("no coords");
      return { lat: +d.latitude, lon: +d.longitude };
    },
    async () => {
      const d = await fetch("https://ipapi.co/json/").then((r) => r.json());
      if (!d.latitude || !d.longitude) throw new Error("no coords");
      return { lat: +d.latitude, lon: +d.longitude };
    },
  ];

  for (const api of apis) {
    try {
      const result = await api();
      if (result.lat && result.lon) return result;
    } catch {
      // try next
    }
  }
  return null;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
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
  // Priority: .env override → browser-supplied coords → IP geo
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
        : await fetchCoords();

  if (!coords) {
    return NextResponse.json({ temp: null, code: 0, city: "---" });
  }

  // Run Mapbox reverse geocoding + Open-Meteo in parallel
  const [city, meteo] = await Promise.allSettled([
    reverseGeocode(coords.lat, coords.lon),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&temperature_unit=celsius`,
    ).then((r) => r.json()),
  ]);

  const cityName = city.status === "fulfilled" ? city.value : "Unknown";
  if (meteo.status === "rejected") {
    return NextResponse.json({ temp: null, code: 0, city: cityName });
  }

  return NextResponse.json({
    temp: Math.round(meteo.value.current.temperature_2m),
    code: meteo.value.current.weather_code,
    city: cityName,
  });
}
