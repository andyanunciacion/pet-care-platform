import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { branch } from './branch.ts';
import { business } from './business.ts';
import { id, timestamps } from './columns.ts';
import { mediaKind } from './enums.ts';
import { product } from './product.ts';

/**
 * An image stored in Cloudflare R2. It belongs to exactly one business, branch or product:
 * one foreign key column per owner type (instead of owner_type + owner_id), so the database
 * checks the owner exists and deletes its images with it (ARCHITECTURE D26).
 */
export const media = pgTable(
  'media',
  {
    id: id(),
    kind: mediaKind().notNull(),
    /** The object's key in the storage bucket. */
    storageKey: text().notNull().unique(),
    /** Required for accessibility (DESIGN §10). */
    alt: text().notNull(),
    /** In pixels; lets pages reserve the image's space before it loads (no layout shift). */
    width: integer().notNull(),
    height: integer().notNull(),
    sortOrder: smallint().notNull().default(0),
    businessId: uuid().references(() => business.id, { onDelete: 'cascade' }),
    branchId: uuid().references(() => branch.id, { onDelete: 'cascade' }),
    productId: uuid().references(() => product.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    check(
      'media_one_owner',
      sql`num_nonnulls(${table.businessId}, ${table.branchId}, ${table.productId}) = 1`,
    ),
    check('media_alt_not_blank', sql`btrim(${table.alt}) <> ''`),
    check('media_dimensions_positive', sql`${table.width} > 0 and ${table.height} > 0`),
    // Logos belong to businesses, and a business has at most one.
    check(
      'media_logo_on_business',
      sql`${table.kind} <> 'logo' or ${table.businessId} is not null`,
    ),
    uniqueIndex('media_one_logo_per_business')
      .on(table.businessId)
      .where(sql`${table.kind} = 'logo'`),
    index().on(table.businessId),
    index().on(table.branchId),
    index().on(table.productId),
  ],
);
