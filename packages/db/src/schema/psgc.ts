import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, index, pgTable, text } from 'drizzle-orm/pg-core';
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
  },
  (table) => [
    check('psgc_area_code_format', sql`${table.code} ~ '^[0-9]{10}$'`),
    index().on(table.parentCode),
  ],
);
