/**
 * URL-safe lowercase words joined by single hyphens, e.g. "paw-vet-clinic". The database
 * checks business and branch slugs against it too (packages/db imports it from here).
 */
export const SLUG_PATTERN = '^[a-z0-9]+(-[a-z0-9]+)*$';

const SLUG_MAX_LENGTH = 80;

/**
 * Turns a name into a slug suggestion: "Dr. Peña's Vet Clinic" → "dr-penas-vet-clinic".
 * Returns "" when the name has no letters or digits (the form then asks for one).
 */
export function slugify(name: string): string {
  return (
    name
      // NFKD splits "ñ" into "n" + a combining tilde, which the next line removes.
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // Apostrophes join words ("cruz's" → "cruzs") instead of splitting them.
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, SLUG_MAX_LENGTH)
      .replace(/-+$/, '')
  );
}
