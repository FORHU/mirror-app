const raw = process.env.NEXT_PUBLIC_DEVICE_MODE ?? 'mirror';
if (raw !== 'mirror' && raw !== 'phone') {
  throw new Error(`NEXT_PUBLIC_DEVICE_MODE must be 'mirror' or 'phone'. Got: '${raw}'`);
}
export const DEVICE_MODE = raw as 'mirror' | 'phone';
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
export const API_URL = process.env.NEXT_PUBLIC_API_URL!;
