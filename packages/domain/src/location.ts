export interface LngLat {
  lng: number;
  lat: number;
}

/**
 * Reads coordinates pasted from Google Maps ("15.1450, 120.5887"): latitude first, like
 * Google shows them. Returns null if the text isn't two numbers in range.
 */
export function parseLatLng(text: string): LngLat | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (match === null) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lng, lat };
}

/**
 * A rough box around the Philippines. Catches swapped coordinates (Google gives "lat, lng",
 * maps libraries want "lng, lat") and pins dropped in the wrong country.
 */
export const PHILIPPINES_BOUNDS = {
  minLng: 116,
  maxLng: 127,
  minLat: 4,
  maxLat: 22,
} as const;

export function isInPhilippines({ lng, lat }: LngLat): boolean {
  const b = PHILIPPINES_BOUNDS;
  return lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat;
}
