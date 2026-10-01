import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, index, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.ts';

/** Stable machine names for taxonomy rows, e.g. "small_mammal", "spay_neuter". */
const codeFormat = (column: AnyPgColumn) => sql`${column} ~ '^[a-z0-9]+(_[a-z0-9]+)*$'`;

/** Animals a branch treats or a service covers (dog, cat, rabbit…). Managed in /admin. */
export const species = pgTable(
  'species',
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull(),
    sortOrder: smallint().notNull().default(0),
    ...timestamps,
  },
  (table) => [check('species_code_format', codeFormat(table.code))],
);

/**
 * Service categories, optionally nested one level (e.g. "Surgery" → "Spay / neuter").
 * Synonyms feed search, so "kapon" finds spay/neuter services (ARCHITECTURE §6).
 */
export const serviceCategory = pgTable(
  'service_category',
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull(),
    // restrict: a category with subcategories can't be deleted out from under them.
    parentId: uuid().references((): AnyPgColumn => serviceCategory.id, { onDelete: 'restrict' }),
    /** Other words owners search with, often Filipino or Taglish: "kapon", "bakuna", "purga". */
    synonyms: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sortOrder: smallint().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check('service_category_code_format', codeFormat(table.code)),
    check('service_category_not_own_parent', sql`${table.parentId} <> ${table.id}`),
    index().on(table.parentId),
  ],
);
