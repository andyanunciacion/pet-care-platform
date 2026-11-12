// The public clinic page's data (DESIGN UX8): a published business and the branches owners
// can see, with everything the page shows. Read-only and open to everyone.
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { addDays, toManila } from '@paw/domain';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { httpError } from '../errors.ts';
import { listServices, PRICE_UNITS } from './branch-services.ts';
import { BUSINESS_TYPES, CLAIM_STATUSES, SlugSchema } from './businesses.ts';
import { listingPaths, publicBranchPlaces } from './listing-paths.ts';

const {
  business,
  branch,
  branchContact,
  branchHours,
  branchHoursException,
  branchService,
  branchSpecies,
  psgcArea,
  species,
} = schema;

const CONTACT_TYPES = schema.contactType.enumValues;
const HOURS_CONFIRMED_BY = schema.hoursConfirmedBy.enumValues;
/** Hidden listings are never public. */
const PUBLIC_STATUSES = ['published', 'permanently_closed'] as const;

// ── Schemas ─────────────────────────────────────────────────────────────────────────────

export const ListingParamsSchema = z.object({ businessSlug: SlugSchema });

const PlaceSchema = z.object({ name: z.string(), slug: z.string() });
const IntervalSchema = z.object({ opensAt: z.string(), closesAt: z.string() });
const SpeciesSchema = z.object({ code: z.string(), name: z.string() });

const ListingBranchSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  /** This branch's page (the business's URL when it's the only branch). */
  path: z.string(),
  addressLine: z.string(),
  barangay: z.object({ name: z.string() }).nullable(),
  city: PlaceSchema,
  province: PlaceSchema,
  location: z.object({ lng: z.number(), lat: z.number() }),
  is24h: z.boolean(),
  acceptsEmergencies: z.boolean(),
  listingStatus: z.enum(PUBLIC_STATUSES),
  hoursConfirmedAt: z.iso.datetime().nullable(),
  hoursConfirmedBy: z.enum(HOURS_CONFIRMED_BY).nullable(),
  /** Sorted by day, then opening time. Times are "HH:MM", Manila wall clock. */
  weekly: z.array(IntervalSchema.extend({ dayOfWeek: z.int() })),
  /**
   * From yesterday (Manila) on, by date. Yesterday's is included because its overnight
   * interval can still be running (ARCHITECTURE D28). Pages are cached, so the browser
   * decides which ones are still upcoming.
   */
  exceptions: z.array(
    z.object({
      date: z.iso.date(),
      isClosed: z.boolean(),
      intervals: z.array(IntervalSchema),
      note: z.string().nullable(),
    }),
  ),
  /** In display order. Phone and Viber are E.164, Messenger a link. */
  contacts: z.array(
    z.object({ type: z.enum(CONTACT_TYPES), value: z.string(), label: z.string().nullable() }),
  ),
  /** "Species treated", in display order. */
  species: z.array(SpeciesSchema),
  /** By category group, then category, then the order they were added. Prices in centavos. */
  services: z.array(
    z.object({
      id: z.uuid(),
      category: z.object({ name: z.string(), groupName: z.string().nullable() }),
      name: z.string(),
      description: z.string().nullable(),
      priceMin: z.int().nullable(),
      priceMax: z.int().nullable(),
      priceUnit: z.enum(PRICE_UNITS),
      priceNote: z.string().nullable(),
      /** Species names, in display order. */
      species: z.array(z.string()),
    }),
  ),
});

export const ListingSchema = z.object({
  business: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    type: z.enum(BUSINESS_TYPES),
    description: z.string().nullable(),
    claimStatus: z.enum(CLAIM_STATUSES),
    listingStatus: z.enum(PUBLIC_STATUSES),
    /** The business's page: the only branch's full page, or the list of its branches. */
    path: z.string(),
  }),
  /** Every branch but hidden ones, in the order they were added. */
  branches: z.array(ListingBranchSchema),
});

export type Listing = z.infer<typeof ListingSchema>;

const listingNotFound = () => httpError(404, 'No listing at this address.');

const isPublic = (status: string): status is (typeof PUBLIC_STATUSES)[number] =>
  (PUBLIC_STATUSES as readonly string[]).includes(status);

/** Postgres returns `time` as "HH:MM:SS"; the API speaks "HH:MM". */
const hhmm = (time: string) => time.slice(0, 5);

/** Groups rows into a map of lists by key, keeping their order. */
function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

// ── Query ───────────────────────────────────────────────────────────────────────────────

export async function getListing(db: Pick<Db, 'select'>, businessSlug: string): Promise<Listing> {
  const [found] = await db.select().from(business).where(eq(business.slug, businessSlug));
  if (found === undefined || !isPublic(found.listingStatus)) throw listingNotFound();

  const places = await publicBranchPlaces(db, found.id);
  const paths = listingPaths(found.slug, places);
  if (paths === null) throw listingNotFound();
  const ids = places.map((place) => place.id);

  const barangay = alias(psgcArea, 'barangay');
  const city = alias(psgcArea, 'city');
  const province = alias(psgcArea, 'province');
  const yesterday = addDays(toManila(new Date()).date, -1);

  const [branches, weekly, exceptions, contacts, treated, services] = await Promise.all([
    db
      .select({
        branch,
        barangayName: barangay.name,
        cityName: city.name,
        provinceName: province.name,
      })
      .from(branch)
      .innerJoin(city, eq(city.code, branch.cityCode))
      .innerJoin(province, eq(province.code, branch.provinceCode))
      .leftJoin(barangay, eq(barangay.code, branch.barangayCode))
      .where(inArray(branch.id, ids)),
    db
      .select()
      .from(branchHours)
      .where(inArray(branchHours.branchId, ids))
      .orderBy(asc(branchHours.dayOfWeek), asc(branchHours.opensAt)),
    db
      .select()
      .from(branchHoursException)
      .where(
        and(inArray(branchHoursException.branchId, ids), gte(branchHoursException.date, yesterday)),
      )
      .orderBy(asc(branchHoursException.date)),
    db
      .select()
      .from(branchContact)
      .where(inArray(branchContact.branchId, ids))
      .orderBy(asc(branchContact.sortOrder), asc(branchContact.id)),
    db
      .select({
        branchId: branchSpecies.branchId,
        id: species.id,
        code: species.code,
        name: species.name,
      })
      .from(branchSpecies)
      .innerJoin(species, eq(species.id, branchSpecies.speciesId))
      .where(inArray(branchSpecies.branchId, ids))
      .orderBy(asc(species.sortOrder), asc(species.name)),
    listServices(db, inArray(branchService.branchId, ids)),
  ]);

  // Service species come as ids; owners read names.
  const serviceSpeciesIds = [...new Set(services.flatMap((service) => service.speciesIds))];
  const speciesNames = new Map(
    serviceSpeciesIds.length === 0
      ? []
      : (
          await db
            .select({ id: species.id, name: species.name })
            .from(species)
            .where(inArray(species.id, serviceSpeciesIds))
        ).map((row) => [row.id, row.name]),
  );

  const byId = new Map(branches.map((row) => [row.branch.id, row]));
  const weeklyBy = groupBy(weekly, (row) => row.branchId);
  const exceptionsBy = groupBy(exceptions, (row) => row.branchId);
  const contactsBy = groupBy(contacts, (row) => row.branchId);
  const speciesBy = groupBy(treated, (row) => row.branchId);
  const servicesBy = groupBy(services, (service) => service.branchId);

  return {
    business: {
      id: found.id,
      slug: found.slug,
      name: found.name,
      type: found.type,
      description: found.description,
      claimStatus: found.claimStatus,
      listingStatus: found.listingStatus,
      path: paths.business,
    },
    branches: places.map((place) => {
      const row = byId.get(place.id);
      const path = paths.branches.get(place.id);
      if (row === undefined || path === undefined)
        throw new Error(`branch ${place.id} went missing`);
      const b = row.branch;
      if (!isPublic(b.listingStatus)) throw new Error(`branch ${b.id} is hidden`);
      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        path,
        addressLine: b.addressLine,
        barangay: row.barangayName === null ? null : { name: row.barangayName },
        city: { name: row.cityName, slug: place.citySlug },
        province: { name: row.provinceName, slug: place.provinceSlug },
        location: b.location,
        is24h: b.is24h,
        acceptsEmergencies: b.acceptsEmergencies,
        listingStatus: b.listingStatus,
        hoursConfirmedAt: b.hoursConfirmedAt?.toISOString() ?? null,
        hoursConfirmedBy: b.hoursConfirmedBy,
        weekly: (weeklyBy.get(b.id) ?? []).map(({ dayOfWeek, opensAt, closesAt }) => ({
          dayOfWeek,
          opensAt: hhmm(opensAt),
          closesAt: hhmm(closesAt),
        })),
        exceptions: (exceptionsBy.get(b.id) ?? []).map(({ date, isClosed, intervals, note }) => ({
          date,
          isClosed,
          intervals,
          note,
        })),
        contacts: (contactsBy.get(b.id) ?? []).map(({ type, value, label }) => ({
          type,
          value,
          label,
        })),
        species: (speciesBy.get(b.id) ?? []).map(({ code, name }) => ({ code, name })),
        services: (servicesBy.get(b.id) ?? []).map((service) => ({
          id: service.id,
          category: { name: service.category.name, groupName: service.category.groupName },
          name: service.name,
          description: service.description,
          priceMin: service.priceMin,
          priceMax: service.priceMax,
          priceUnit: service.priceUnit,
          priceNote: service.priceNote,
          species: service.speciesIds.flatMap((id) => speciesNames.get(id) ?? []),
        })),
      };
    }),
  };
}
