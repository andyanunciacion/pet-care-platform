import { SLUG_PATTERN } from '@paw/domain';
import { sql } from 'drizzle-orm';
import { check, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.ts';
import { businessType, claimStatus, listingStatus } from './enums.ts';

/** URL-safe lowercase words joined by single hyphens (defined in @paw/domain, shared with forms). */
export const slugPattern = SLUG_PATTERN;

/** A brand or owner. Most public data hangs off its branches (ARCHITECTURE D9). */
export const business = pgTable(
  'business',
  {
    id: id(),
    name: text().notNull(),
    /** Used in URLs: /{province}/{city}/{slug}. Unique across PAW. */
    slug: text().notNull().unique(),
    type: businessType().notNull(),
    description: text(),
    claimStatus: claimStatus().notNull().default('unclaimed'),
    /** New listings start hidden, so a half-filled listing never goes public by accident. */
    listingStatus: listingStatus().notNull().default('hidden'),
    /** Where PAW got the data (e.g. "Clinic visit", "Facebook page"), for honest sourcing. */
    dataSource: text(),
    ...timestamps,
  },
  (table) => [check('business_slug_format', sql`${table.slug} ~ ${sql.raw(`'${slugPattern}'`)}`)],
);
