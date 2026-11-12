// Deep links for the clinic page's contact actions (DESIGN UX9). Phone and Viber numbers
// are E.164 (+63…), Messenger values are links (checked by the API when they're entered).

import type { LngLat } from '@paw/domain';

export function telLink(e164: string): string {
  return `tel:${e164}`;
}

/** Opens a chat in the Viber app; the "+" must be encoded. */
export function viberLink(e164: string): string {
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}

export function mailLink(email: string): string {
  return `mailto:${email}`;
}

/** The two apps owners navigate with (DESIGN UX9); the clinic page remembers the choice. */
export const DIRECTIONS_APPS = ['google_maps', 'waze'] as const;
export type DirectionsApp = (typeof DIRECTIONS_APPS)[number];

export const isDirectionsApp = (value: unknown): value is DirectionsApp =>
  (DIRECTIONS_APPS as readonly unknown[]).includes(value);

/** Turn-by-turn directions to the pin. Both open the app when it's installed, the web otherwise. */
export function directionsLink(app: DirectionsApp, { lat, lng }: LngLat): string {
  const destination = `${String(lat)},${String(lng)}`;
  return app === 'waze'
    ? `https://waze.com/ul?ll=${encodeURIComponent(destination)}&navigate=yes`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** "+639171234567" → "0917 123 4567"; landlines "+63458881234" → "(045) 888 1234". */
export function phoneLabel(e164: string): string {
  if (!e164.startsWith('+63')) return e164;
  const national = `0${e164.slice(3)}`;
  if (/^09\d{9}$/.test(national)) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  // Metro Manila landlines have a 1-digit area code (02), the rest 2 digits (045, 032…).
  if (/^02\d{8}$/.test(national)) {
    return `(02) ${national.slice(2, 6)} ${national.slice(6)}`;
  }
  if (/^0\d{9}$/.test(national)) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return national;
}
