// Distances on result cards: "650 m", "2.1 km", "12 km". Rounded to what a coordinate rounded
// to ~110 m can honestly tell (search URLs carry the owner's position at 3 decimals, D46).

export function distanceLabel(meters: number, locale: string): string {
  if (meters < 1000) {
    const rounded = Math.max(100, Math.round(meters / 100) * 100);
    // 950 m and up rounds to 1,000 m: say "1 km" instead.
    if (rounded < 1000) {
      return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter' }).format(rounded);
    }
  }
  const km = meters / 1000;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: km < 10 ? 1 : 0,
  }).format(km);
}
