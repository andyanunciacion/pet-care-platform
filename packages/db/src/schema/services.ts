import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { branch } from './branch.ts';
import { id, timestamps } from './columns.ts';
import { priceUnit } from './enums.ts';
import { serviceCategory, species } from './taxonomy.ts';

// Link tables use real foreign keys (instead of an id array on the parent row), so the
// database guarantees every linked species exists (ARCHITECTURE D25). They only get
// created_at: a link is added or removed, never edited.

/** The species a branch treats, shown as "Species treated" on the clinic page. */
export const branchSpecies = pgTable(
  'branch_species',
  {
    branchId: uuid()
      .notNull()
      .references(() => branch.id, { onDelete: 'cascade' }),
    // restrict: a species still in use can't be deleted from the taxonomy.
    speciesId: uuid()
      .notNull()
      .references(() => species.id, { onDelete: 'restrict' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.branchId, table.speciesId] }),
    index().on(table.speciesId),
  ],
);

/**
 * A service a branch offers, with an estimated price range in centavos.
 * Both prices set: "₱500–₱800". Only the minimum: "From ₱500". Neither: "Call for price".
 */
export const branchService = pgTable(
  'branch_service',
  {
    id: id(),
    branchId: uuid()
      .notNull()
      .references(() => branch.id, { onDelete: 'cascade' }),
    categoryId: uuid()
      .notNull()
      .references(() => serviceCategory.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    description: text(),
    priceMin: integer(),
    priceMax: integer(),
    priceUnit: priceUnit().notNull().default('per_visit'),
    /** e.g. "Depends on weight", "Includes anesthesia". */
    priceNote: text(),
    sortOrder: smallint().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check('branch_service_price_min_positive', sql`${table.priceMin} >= 0`),
    // A maximum needs a minimum, and can't be below it.
    check(
      'branch_service_price_range',
      sql`${table.priceMax} is null or (${table.priceMin} is not null and ${table.priceMax} >= ${table.priceMin})`,
    ),
    index().on(table.branchId),
    index().on(table.categoryId),
  ],
);

/** The species a service covers, e.g. spay/neuter for dogs and cats only. */
export const branchServiceSpecies = pgTable(
  'branch_service_species',
  {
    branchServiceId: uuid()
      .notNull()
      .references(() => branchService.id, { onDelete: 'cascade' }),
    speciesId: uuid()
      .notNull()
      .references(() => species.id, { onDelete: 'restrict' }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.branchServiceId, table.speciesId] }),
    index().on(table.speciesId),
  ],
);
