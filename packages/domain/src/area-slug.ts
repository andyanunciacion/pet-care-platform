// URL slugs for PSGC areas (ARCHITECTURE D42): /pampanga/angeles-city/…
import { slugify } from './slug.ts';

/** The PSGC levels that appear in URLs (barangays don't). */
export type AreaSlugLevel = 'province' | 'city' | 'municipality';

/**
 * A province's, city's or municipality's URL slug. Cities end in "-city" however the PSA
 * writes them ("City of Angeles", "Mabalacat City", "Science City of Muñoz" →
 * "angeles-city", "mabalacat-city", "munoz-city"), which is how people search for them.
 * Municipalities and provinces are their plain name ("Sto. Tomas" → "sto-tomas"). Former
 * names in parentheses ("Sasmuan (Sexmoan)") are dropped.
 *
 * The database stores the result (`psgc_area.slug`); a test checks every row matches.
 */
export function areaSlug(name: string, level: AreaSlugLevel): string {
  const withoutFormerName = name.replace(/\s*\([^)]*\)/g, '');
  if (level !== 'city') return slugify(withoutFormerName);
  const base = withoutFormerName
    .replace(/^.*\bcity of\s+/i, '')
    .replace(/\s+city$/i, '')
    .trim();
  return `${slugify(base)}-city`;
}
