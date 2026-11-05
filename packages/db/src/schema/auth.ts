import { boolean, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.ts';
import { platformRole } from './enums.ts';

// Better Auth's core tables (ARCHITECTURE §7), written by hand in our style. The field
// names must match Better Auth's (its Drizzle adapter looks columns up by them), so check
// its core schema (@better-auth/core, db/get-tables) when upgrading. Ids are UUID v7 from
// the database: the API sets Better Auth's `generateId: 'uuid'`, which leaves them to us.

/** Anyone with an account: PAW ops now, clinic staff from slice 8, pet owners in P2. */
export const user = pgTable('user', {
  id: id(),
  name: text().notNull(),
  /** Stored lowercase by Better Auth. Required while Google is the only sign-in method. */
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  /** Profile photo URL from the sign-in provider. */
  image: text(),
  /**
   * `super_admin` can use /admin. Users can never set this themselves (Better Auth
   * `input: false`); only `pnpm --filter @paw/api promote-admin` changes it.
   */
  platformRole: platformRole().notNull().default('user'),
  ...timestamps,
});

/** A signed-in browser. The cookie holds the signed `token`. */
export const session = pgTable(
  'session',
  {
    id: id(),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Kept for security review and rate limiting; personal data, never logged. */
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [index().on(table.userId)],
);

/** A way to sign in for a user, e.g. their Google account (`providerId` = "google"). */
export const account = pgTable(
  'account',
  {
    id: id(),
    /** The provider's id for this person (Google's "sub"). */
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    /** Unused: PAW has no password sign-in. */
    password: text(),
    ...timestamps,
  },
  (table) => [
    index().on(table.userId),
    // One provider account belongs to one PAW user.
    unique().on(table.providerId, table.accountId),
  ],
);

/** Short-lived values Better Auth checks later, e.g. the OAuth state during Google sign-in. */
export const verification = pgTable(
  'verification',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.identifier)],
);
