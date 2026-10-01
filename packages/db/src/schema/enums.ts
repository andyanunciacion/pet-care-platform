import { pgEnum } from 'drizzle-orm/pg-core';

// Postgres enums: the database itself rejects any other value. Adding a value later is a
// one-line migration (ALTER TYPE … ADD VALUE); removing one is hard, so add values only
// when they're used.

/** Launch is vets only (ARCHITECTURE §5.3). Groomers, boarding and pet shops are added here later. */
export const businessType = pgEnum('business_type', ['vet_clinic']);

export const claimStatus = pgEnum('claim_status', ['unclaimed', 'pending', 'verified']);

/** Whether a business or branch shows on the public site. */
export const listingStatus = pgEnum('listing_status', [
  'published',
  'hidden',
  'permanently_closed',
]);

/** Who last confirmed a branch's hours (shown as "confirmed … by the clinic / by PAW"). */
export const hoursConfirmedBy = pgEnum('hours_confirmed_by', ['clinic', 'paw_ops', 'report']);

export const contactType = pgEnum('contact_type', ['phone', 'messenger', 'viber', 'email']);

/** PSGC levels PAW uses. Cities and municipalities share a level in URLs, but PSGC keeps them apart. */
export const psgcLevel = pgEnum('psgc_level', ['province', 'city', 'municipality', 'barangay']);

/** What a service price covers. Shown after the price unless it's per visit ("₱800/night"). */
export const priceUnit = pgEnum('price_unit', ['per_visit', 'per_session', 'per_night', 'per_day']);

/** No stock counts, only a rough availability (PRD: simple products). */
export const productAvailability = pgEnum('product_availability', ['available', 'limited', 'out']);

export const mediaKind = pgEnum('media_kind', ['logo', 'photo']);
