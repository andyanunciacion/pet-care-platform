import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { business, slugPattern } from './business.ts';
import { geographyPoint, id, timestamps } from './columns.ts';
import { contactType, hoursConfirmedBy, listingStatus } from './enums.ts';
import { psgcArea } from './psgc.ts';

/**
 * A physical location with its own address, contacts and hours. Public data hangs off
 * the branch, even for single-branch businesses (ARCHITECTURE D9).
 */
export const branch = pgTable(
  'branch',
  {
    id: id(),
    // restrict: a business with branches can't be deleted by accident (hide it instead).
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    /** Unique within its business; used in URLs when a business has several branches. */
    slug: text().notNull(),
    /** Street, building, landmark. The barangay, city and province come from the PSGC codes. */
    addressLine: text().notNull(),
    provinceCode: text()
      .notNull()
      .references(() => psgcArea.code),
    cityCode: text()
      .notNull()
      .references(() => psgcArea.code),
    barangayCode: text().references(() => psgcArea.code),
    /** The map pin. Required: a branch without one can't appear in distance search. */
    location: geographyPoint().notNull(),
    // Named explicitly: the automatic snake_case conversion would make it "is24h".
    is24h: boolean('is_24h').notNull().default(false),
    acceptsEmergencies: boolean().notNull().default(false),
    /** Visibility follows the business; this lets a single branch close for good. */
    listingStatus: listingStatus().notNull().default('published'),
    hoursConfirmedAt: timestamp({ withTimezone: true }),
    hoursConfirmedBy: hoursConfirmedBy(),
    ...timestamps,
  },
  (table) => [
    unique().on(table.businessId, table.slug),
    check('branch_slug_format', sql`${table.slug} ~ ${sql.raw(`'${slugPattern}'`)}`),
    // "Confirmed 5 days ago by PAW" needs both halves.
    check(
      'branch_hours_confirmed_pair',
      sql`(${table.hoursConfirmedAt} is null) = (${table.hoursConfirmedBy} is null)`,
    ),
    index().on(table.businessId),
    index().on(table.cityCode),
    // GiST index: makes radius filters (ST_DWithin) and nearest-first ordering (<->) fast.
    index().using('gist', table.location),
  ],
);

/** Phone numbers and messaging channels. A branch can list several of each. */
export const branchContact = pgTable(
  'branch_contact',
  {
    id: id(),
    branchId: uuid()
      .notNull()
      .references(() => branch.id, { onDelete: 'cascade' }),
    type: contactType().notNull(),
    /** E.164 for phone and Viber (+63…), a URL for Messenger, an address for email. */
    value: text().notNull(),
    /** Shown next to the value, e.g. "Globe", "Smart", "Landline". */
    label: text(),
    sortOrder: smallint().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    // A last line of defense; forms validate the format first (with Zod).
    check(
      'branch_contact_phone_e164',
      sql`${table.type} not in ('phone', 'viber') or ${table.value} ~ '^\\+[1-9][0-9]{7,14}$'`,
    ),
    index().on(table.branchId),
  ],
);

/**
 * Weekly opening hours, as wall-clock times in Asia/Manila. Several rows on one day mean
 * a lunch break; closesAt earlier than opensAt means the interval runs past midnight.
 * A branch with no rows (and not 24h) has no hours data (DESIGN UX17).
 */
export const branchHours = pgTable(
  'branch_hours',
  {
    id: id(),
    branchId: uuid()
      .notNull()
      .references(() => branch.id, { onDelete: 'cascade' }),
    /** ISO weekday: 1 = Monday … 7 = Sunday (same as Postgres's isodow). */
    dayOfWeek: smallint().notNull(),
    opensAt: time().notNull(),
    closesAt: time().notNull(),
    ...timestamps,
  },
  (table) => [
    check('branch_hours_day_of_week', sql`${table.dayOfWeek} between 1 and 7`),
    // Equal times would be ambiguous (closed, or open 24 hours?); 24h is a branch flag.
    check('branch_hours_not_empty', sql`${table.opensAt} <> ${table.closesAt}`),
    index().on(table.branchId),
  ],
);

/** An opening interval on an exception date; same rules as branch_hours. */
export interface HoursInterval {
  opensAt: string;
  closesAt: string;
}

/** A date with different hours (holiday, special closure). Replaces that day's weekly hours. */
export const branchHoursException = pgTable(
  'branch_hours_exception',
  {
    id: id(),
    branchId: uuid()
      .notNull()
      .references(() => branch.id, { onDelete: 'cascade' }),
    date: date({ mode: 'string' }).notNull(),
    isClosed: boolean().notNull(),
    /** Opening intervals for the day; empty when closed. */
    intervals: jsonb().$type<HoursInterval[]>().notNull().default([]),
    /** Shown to owners, e.g. "Closed for All Saints' Day". */
    note: text(),
    ...timestamps,
  },
  (table) => [
    unique().on(table.branchId, table.date),
    check(
      'branch_hours_exception_intervals_array',
      sql`jsonb_typeof(${table.intervals}) = 'array'`,
    ),
    // Closed exactly when there are no intervals.
    check(
      'branch_hours_exception_closed_or_open',
      sql`${table.isClosed} = (${table.intervals} = '[]'::jsonb)`,
    ),
  ],
);
