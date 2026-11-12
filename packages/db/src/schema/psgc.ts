import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { SLUG_PATTERN } from '@paw/domain';
import { psgcLevel } from './enums.ts';

/**
 * Philippine Standard Geographic Code areas (reference data from the PSA).
 * Codes are 10 digits and can start with 0, so they're stored as text.
 */
export const psgcArea = pgTable(
  'psgc_area',
  {
    code: text().primaryKey(),
    name: text().notNull(),
    level: psgcLevel().notNull(),
    /** Province for a city/municipality, city/municipality for a barangay. Null for provinces. */
    parentCode: text().references((): AnyPgColumn => psgcArea.code),
    /**
     * The area's part of public URLs (/pampanga/angeles-city/…), from areaSlug() in
     * @paw/domain (ARCHITECTURE D42). Null for barangays, which aren't in URLs.
     */
    slug: text(),
  },
  (table) => [
    check('psgc_area_code_format', sql`${table.code} ~ '^[0-9]{10}$'`),
    check('psgc_area_slug_format', sql`${table.slug} ~ ${sql.raw(`'${SLUG_PATTERN}'`)}`),
    check('psgc_area_slug_by_level', sql`(${table.level} = 'barangay') = (${table.slug} is null)`),
    index().on(table.parentCode),
    // Unique among the areas of one province (and among provinces), so a URL finds one area.
    uniqueIndex('psgc_area_slug_unique')
      .on(sql`coalesce(${table.parentCode}, '')`, table.slug)
      .where(sql`${table.slug} is not null`),
  ],
);
