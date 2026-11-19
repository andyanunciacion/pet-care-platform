// Public search (ARCHITECTURE §6, D45): published branches near a point or in a city,
// matched against the query's words, filtered, ranked and paged. SQL finds the candidates
// and where each word hits (full-text + trigram); @paw/domain decides what matches, what's
// open and the order, with the same hours code the browser runs (D1).
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import {
  addDays,
  compareSortKeys,
  DEFAULT_PAGE_SIZE,
  DEFAULT_RADIUS_KM,
  type EmergencyGroup,
  FIELD_SCORES,
  freshness,
  isInPhilippines,
  isOpenNow,
  LOOKAHEAD_DAYS,
  type ListingMatch,
  matchListing,
  MAX_MATCHED_SERVICES,
  MAX_PAGE_SIZE,
  MAX_RADIUS_KM,
  searchScore,
  searchSortKey,
  searchTerms,
  type TokenHits,
  toManila,
  TYPO_MIN_LENGTH,
  TYPO_MIN_SIMILARITY,
} from '@paw/domain';
import { and, asc, eq, exists, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { httpError } from '../errors.ts';
import { listServices, PRICE_UNITS } from './branch-services.ts';
import { CLAIM_STATUSES } from './businesses.ts';
import { listingPaths, publicBranchPlacesByBusiness } from './listing-paths.ts';
import { groupBy, hhmm } from './rows.ts';

const {
  business,
  branch,
  branchContact,
  branchHours,
  branchHoursException,
  branchService,
  branchServiceSpecies,
  branchSpecies,
  psgcArea,
  searchLog,
  serviceCategory,
  species,
} = schema;

const HOURS_CONFIRMED_BY = schema.hoursConfirmedBy.enumValues;

// ── Schemas ─────────────────────────────────────────────────────────────────────────────

/** A species or category code, e.g. "rabbit", "spay_neuter". */
const TaxonomyCodeSchema = z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);
const BooleanParamSchema = z.enum(['true', 'false']);

export const SearchQuerySchema = z
  .object({
    /** Free text: clinic names, places, services, Filipino terms ("kapon", "bakuna"). */
    q: z.string().max(200).optional(),
    /** The owner's location. Both or neither. */
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    /** Only with lat/lng. */
    radiusKm: z.coerce.number().positive().max(MAX_RADIUS_KM).optional(),
    /** A city or municipality's PSGC code: the picker used when location is off (UX1). Not with lat/lng. */
    cityCode: z
      .string()
      .regex(/^[0-9]{10}$/)
      .optional(),
    species: TaxonomyCodeSchema.optional(),
    /** A category, or a group (then any category in it). */
    category: TaxonomyCodeSchema.optional(),
    openNow: BooleanParamSchema.optional(),
    /** Open now first, then closed branches that accept emergencies by phone (UX7, UX19). */
    emergency: BooleanParamSchema.optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    /** `nextCursor` from the previous page. */
    cursor: z.string().max(500).optional(),
  })
  .superRefine((query, context) => {
    const hasLat = query.lat !== undefined;
    const hasLng = query.lng !== undefined;
    if (hasLat !== hasLng) {
      context.addIssue({
        code: 'custom',
        path: [hasLat ? 'lng' : 'lat'],
        message: 'Send both lat and lng.',
      });
    }
    if (query.lat !== undefined && query.lng !== undefined) {
      if (!isInPhilippines({ lat: query.lat, lng: query.lng })) {
        context.addIssue({
          code: 'custom',
          path: ['lat'],
          message: 'This point is outside the Philippines.',
        });
      }
      if (query.cityCode !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['cityCode'],
          message: 'Search near a point or in a city, not both.',
        });
      }
    } else if (query.radiusKm !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['radiusKm'],
        message: 'A radius needs lat and lng.',
      });
    }
  });

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

const IntervalSchema = z.object({ opensAt: z.string(), closesAt: z.string() });

const SearchBranchSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** The branch's page (ARCHITECTURE §8). */
  path: z.string(),
  addressLine: z.string(),
  barangay: z.object({ name: z.string() }).nullable(),
  city: z.object({ name: z.string() }),
  location: z.object({ lng: z.number(), lat: z.number() }),
  is24h: z.boolean(),
  acceptsEmergencies: z.boolean(),
  hoursConfirmedAt: z.iso.datetime().nullable(),
  hoursConfirmedBy: z.enum(HOURS_CONFIRMED_BY).nullable(),
  /** As on the clinic page: the browser works out the open status (DESIGN UX20). */
  weekly: z.array(IntervalSchema.extend({ dayOfWeek: z.int() })),
  /** From yesterday (Manila) to LOOKAHEAD_DAYS ahead, by date. */
  exceptions: z.array(
    z.object({
      date: z.iso.date(),
      isClosed: z.boolean(),
      intervals: z.array(IntervalSchema),
      note: z.string().nullable(),
    }),
  ),
  /** "Species treated", in display order. */
  species: z.array(z.object({ code: z.string(), name: z.string() })),
  /** The first phone number (E.164), for the card's Call button (UX3). */
  phone: z.string().nullable(),
  /** The first Messenger link ("Message before you go", UX17). */
  messenger: z.string().nullable(),
});

const SearchResultBaseSchema = z.object({
  business: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    claimStatus: z.enum(CLAIM_STATUSES),
  }),
  branch: SearchBranchSchema,
  /** Meters from the search point; null for a city or area-wide search. */
  distanceM: z.int().nullable(),
  /** Emergency searches only: open now, or closed but takes emergency calls. */
  emergency: z.enum(['open', 'callable']).nullable(),
});

const SearchServiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: z.object({ name: z.string(), groupName: z.string().nullable() }),
  /** Centavos. */
  priceMin: z.int().nullable(),
  priceMax: z.int().nullable(),
  priceUnit: z.enum(PRICE_UNITS),
  priceNote: z.string().nullable(),
  /** Species names, in display order. */
  species: z.array(z.string()),
});

export const SearchResultSchema = z.discriminatedUnion('kind', [
  /** The search matched the branch itself (name, place, species) or is a browse. */
  SearchResultBaseSchema.extend({ kind: z.literal('branch') }),
  /** The search matched services ("kapon"): the card shows the first one with its price (UX3). */
  SearchResultBaseSchema.extend({
    kind: z.literal('service'),
    /** Best first, at most MAX_MATCHED_SERVICES. */
    services: z.array(SearchServiceSchema).min(1),
  }),
]);

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  /** Matches across all pages. */
  total: z.int(),
  /** Pass as `cursor` for the next page; null on the last one. */
  nextCursor: z.string().nullable(),
  /** Service categories the query named, e.g. "kapon" → Spay / neuter, so the page can say what it searched for. */
  matchedCategories: z.array(z.object({ code: z.string(), name: z.string() })),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/** What the route writes to search_log for a first page. */
export interface SearchLogEntry {
  query: string;
  filters: schema.SearchLogFilters;
  area: string | null;
  resultCount: number;
}

// ── Cursor (keyset pagination) ──────────────────────────────────────────────────────────

const CursorSchema = z.object({ k: z.array(z.number()).min(1).max(3), id: z.uuid() });
type Cursor = z.infer<typeof CursorSchema>;

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url');

function decodeCursor(text: string): Cursor {
  try {
    return CursorSchema.parse(JSON.parse(Buffer.from(text, 'base64url').toString('utf8')));
  } catch {
    throw httpError(400, 'The cursor is invalid. Start the search again.');
  }
}

// ── Steps ───────────────────────────────────────────────────────────────────────────────

/**
 * The words Postgres can search for: English stop words ("the", "for") parse to an empty
 * query and would match nothing, so they're dropped here.
 */
async function meaningfulTokens(db: Db, tokens: readonly string[]): Promise<string[]> {
  if (tokens.length === 0) return [];
  const { rows } = await db.execute<{ t: string }>(sql`
    select t from unnest(${sql.param(tokens)}::text[]) with ordinality as x (t, ord)
    where numnode(to_tsquery('english', t)) > 0
    order by ord`);
  return rows.map((row) => row.t);
}

/** Ids for the species and category filters; 400 for an unknown code. */
async function resolveFilters(
  db: Db,
  query: SearchQuery,
): Promise<{ speciesId: string | null; categoryIds: string[] | null }> {
  let speciesId: string | null = null;
  if (query.species !== undefined) {
    const [row] = await db
      .select({ id: species.id })
      .from(species)
      .where(eq(species.code, query.species));
    if (row === undefined) throw httpError(400, `Unknown species "${query.species}".`);
    speciesId = row.id;
  }
  let categoryIds: string[] | null = null;
  if (query.category !== undefined) {
    const parent = alias(serviceCategory, 'parent');
    const rows = await db
      .select({ id: serviceCategory.id })
      .from(serviceCategory)
      .leftJoin(parent, eq(parent.id, serviceCategory.parentId))
      .where(or(eq(serviceCategory.code, query.category), eq(parent.code, query.category)));
    if (rows.length === 0) throw httpError(400, `Unknown category "${query.category}".`);
    categoryIds = rows.map((row) => row.id);
  }
  return { speciesId, categoryIds };
}

/** A tsquery for one word: a prefix match from 3 letters ("vacc" → vaccination), exact below. */
const wordQuery = (word: SQL) =>
  sql`to_tsquery('english', case when length(${word}) >= 3 then ${word} || ':*' else ${word} end)`;

/** The search point as PostGIS geography. */
const pointOf = (lat: number, lng: number) =>
  sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)::geography`;

/** Services a search may show: in the category filter, and covering the species (or naming none, UX21). */
function serviceFilter(speciesId: string | null, categoryIds: string[] | null): SQL | undefined {
  return and(
    categoryIds === null ? undefined : inArray(branchService.categoryId, categoryIds),
    speciesId === null
      ? undefined
      : sql`(not exists (select 1 from ${branchServiceSpecies} where ${branchServiceSpecies.branchServiceId} = ${branchService.id})
          or exists (select 1 from ${branchServiceSpecies} where ${branchServiceSpecies.branchServiceId} = ${branchService.id} and ${branchServiceSpecies.speciesId} = ${speciesId}))`,
  );
}

interface Candidate {
  id: string;
  businessId: string;
  businessSlug: string;
  businessName: string;
  claimStatus: (typeof CLAIM_STATUSES)[number];
  name: string;
  addressLine: string;
  cityName: string;
  barangayName: string | null;
  location: { lng: number; lat: number };
  is24h: boolean;
  acceptsEmergencies: boolean;
  hoursConfirmedAt: Date | null;
  hoursConfirmedBy: (typeof HOURS_CONFIRMED_BY)[number] | null;
  hasWeekly: boolean;
  hasPhone: boolean;
  distanceM: number | null;
}

/** Published branches of published businesses, in the area and passing the taxonomy filters. */
async function findCandidates(
  db: Db,
  query: SearchQuery,
  speciesId: string | null,
  categoryIds: string[] | null,
): Promise<Candidate[]> {
  const city = alias(psgcArea, 'city');
  const barangay = alias(psgcArea, 'barangay');
  const point =
    query.lat !== undefined && query.lng !== undefined ? pointOf(query.lat, query.lng) : null;
  const radiusM = (query.radiusKm ?? DEFAULT_RADIUS_KM) * 1000;
  const services = serviceFilter(speciesId, categoryIds);

  return db
    .select({
      id: branch.id,
      businessId: business.id,
      businessSlug: business.slug,
      businessName: business.name,
      claimStatus: business.claimStatus,
      name: branch.name,
      addressLine: branch.addressLine,
      cityName: city.name,
      barangayName: barangay.name,
      location: branch.location,
      is24h: branch.is24h,
      acceptsEmergencies: branch.acceptsEmergencies,
      hoursConfirmedAt: branch.hoursConfirmedAt,
      hoursConfirmedBy: branch.hoursConfirmedBy,
      hasWeekly: sql<boolean>`exists (select 1 from ${branchHours} where ${branchHours.branchId} = ${branch.id})`,
      hasPhone: sql<boolean>`exists (select 1 from ${branchContact} where ${branchContact.branchId} = ${branch.id} and ${branchContact.type} = 'phone')`,
      distanceM:
        point === null
          ? sql<null>`null`
          : sql<number>`ST_Distance(${branch.location}, ${point})`.mapWith(Number),
    })
    .from(branch)
    .innerJoin(business, eq(business.id, branch.businessId))
    .innerJoin(city, eq(city.code, branch.cityCode))
    .leftJoin(barangay, eq(barangay.code, branch.barangayCode))
    .where(
      and(
        // Permanently closed listings keep their page, but aren't search results.
        eq(business.listingStatus, 'published'),
        eq(branch.listingStatus, 'published'),
        point === null ? undefined : sql`ST_DWithin(${branch.location}, ${point}, ${radiusM})`,
        query.cityCode === undefined ? undefined : eq(branch.cityCode, query.cityCode),
        speciesId === null
          ? undefined
          : exists(
              db
                .select({ one: sql`1` })
                .from(branchSpecies)
                .where(
                  and(
                    eq(branchSpecies.branchId, branch.id),
                    eq(branchSpecies.speciesId, speciesId),
                  ),
                ),
            ),
        categoryIds === null
          ? undefined
          : exists(
              db
                .select({ one: sql`1` })
                .from(branchService)
                .where(and(eq(branchService.branchId, branch.id), services)),
            ),
      ),
    );
}

interface Hit {
  branchId: string;
  /** Null for the branch's own document. */
  serviceId: string | null;
  /** Index into the tokens. */
  ord: number;
  own: number;
  species: boolean;
}

/**
 * Where each word hits, per document: the branch's (business + branch names, city and
 * barangay, species treated, description) and each eligible service's (name, category with
 * its group and synonyms, species — the branch's when the service names none —, description).
 * Only rows with a hit come back. Documents are built at query time (D45): the candidates
 * are already narrowed down by area, so no stored tsvector has to be kept in sync.
 */
async function findHits(
  db: Db,
  tokens: readonly string[],
  branchIds: readonly string[],
  speciesId: string | null,
  categoryIds: string[] | null,
): Promise<Hit[]> {
  if (tokens.length === 0 || branchIds.length === 0) return [];
  const ids = sql`${sql.param(branchIds)}::uuid[]`;
  const services = serviceFilter(speciesId, categoryIds);
  const speciesText = sql`string_agg(${species.name} || ' ' || array_to_string(${species.synonyms}, ' '), ' ')`;

  const { rows } = await db.execute<{
    branch_id: string;
    service_id: string | null;
    ord: number;
    own: number;
    species: boolean;
  }>(sql`
    with tokens as (
      select t, (ord - 1)::int as ord, ${wordQuery(sql`t`)} as tq
      from unnest(${sql.param(tokens)}::text[]) with ordinality as x (t, ord)
    ),
    treated as (
      select ${branchSpecies.branchId} as branch_id, ${speciesText} as text
      from ${branchSpecies} join ${species} on ${species.id} = ${branchSpecies.speciesId}
      where ${branchSpecies.branchId} = any(${ids})
      group by ${branchSpecies.branchId}
    ),
    docs as (
      select b.id as branch_id, null::uuid as service_id,
        to_tsvector('english', bu.name || ' ' || b.name) as name_vec,
        to_tsvector('english', city.name || ' ' || coalesce(barangay.name, '')) as category_vec,
        to_tsvector('english', coalesce(bu.description, '')) as description_vec,
        lower(bu.name || ' ' || b.name || ' ' || city.name || ' ' || coalesce(barangay.name, '')) as typo_text,
        to_tsvector('english', coalesce(treated.text, '')) as species_vec
      from branch b
        join business bu on bu.id = b.business_id
        join psgc_area city on city.code = b.city_code
        left join psgc_area barangay on barangay.code = b.barangay_code
        left join treated on treated.branch_id = b.id
      where b.id = any(${ids})
      union all
      select ${branchService.branchId}, ${branchService.id},
        to_tsvector('english', ${branchService.name}),
        to_tsvector('english', category.name || ' ' || coalesce(category_group.name, '') || ' ' || array_to_string(category.synonyms, ' ')),
        to_tsvector('english', coalesce(${branchService.description}, '') || ' ' || coalesce(${branchService.priceNote}, '')),
        lower(${branchService.name} || ' ' || category.name || ' ' || array_to_string(category.synonyms, ' ')),
        to_tsvector('english', coalesce(covered.text, treated.text, ''))
      from ${branchService}
        join service_category category on category.id = ${branchService.categoryId}
        left join service_category category_group on category_group.id = category.parent_id
        left join treated on treated.branch_id = ${branchService.branchId}
        left join lateral (
          select ${speciesText} as text
          from ${branchServiceSpecies} join ${species} on ${species.id} = ${branchServiceSpecies.speciesId}
          where ${branchServiceSpecies.branchServiceId} = ${branchService.id}
        ) covered on true
      where ${branchService.branchId} = any(${ids}) ${services === undefined ? sql`` : sql`and ${services}`}
    ),
    scored as (
      select docs.branch_id, docs.service_id, tokens.ord,
        greatest(
          case when docs.name_vec @@ tokens.tq then ${FIELD_SCORES.name}::float8 else 0 end,
          case when docs.category_vec @@ tokens.tq then ${FIELD_SCORES.category}::float8 else 0 end,
          case when docs.description_vec @@ tokens.tq then ${FIELD_SCORES.description}::float8 else 0 end,
          case
            when length(tokens.t) >= ${TYPO_MIN_LENGTH}::int
              and word_similarity(tokens.t, docs.typo_text) >= ${TYPO_MIN_SIMILARITY}::float8
            then 0.5 * word_similarity(tokens.t, docs.typo_text)
            else 0
          end
        )::float8 as own,
        docs.species_vec @@ tokens.tq as species
      from docs cross join tokens
    )
    select branch_id, service_id, ord, own, species from scored where own > 0 or species`);

  return rows.map((row) => ({
    branchId: row.branch_id,
    serviceId: row.service_id,
    // node-postgres parses int and float8 into numbers (hence the casts in the SQL).
    ord: row.ord,
    own: row.own,
    species: row.species,
  }));
}

/** Leaf categories the query names, by name or synonym (with typos), in display order. */
async function findMatchedCategories(
  db: Db,
  tokens: readonly string[],
): Promise<{ code: string; name: string }[]> {
  if (tokens.length === 0) return [];
  const text = sql`(${serviceCategory.name} || ' ' || array_to_string(${serviceCategory.synonyms}, ' '))`;
  const parent = alias(serviceCategory, 'parent');
  return db
    .select({ code: serviceCategory.code, name: serviceCategory.name })
    .from(serviceCategory)
    .innerJoin(parent, eq(parent.id, serviceCategory.parentId))
    .where(
      sql`exists (
        select 1 from unnest(${sql.param(tokens)}::text[]) as t
        where to_tsvector('english', ${text}) @@ ${wordQuery(sql`t`)}
          or (length(t) >= ${TYPO_MIN_LENGTH}::int and word_similarity(t, lower(${text})) >= ${TYPO_MIN_SIMILARITY}::float8)
      )`,
    )
    .orderBy(asc(parent.sortOrder), asc(serviceCategory.sortOrder), asc(serviceCategory.name));
}

/** The first eligible services of each branch, for category searches that matched the branch itself. */
async function categoryServices(
  db: Db,
  branchIds: readonly string[],
  speciesId: string | null,
  categoryIds: string[],
): Promise<Map<string, string[]>> {
  if (branchIds.length === 0) return new Map();
  const rows = await db
    .select({ id: branchService.id, branchId: branchService.branchId })
    .from(branchService)
    .innerJoin(serviceCategory, eq(serviceCategory.id, branchService.categoryId))
    .where(
      and(inArray(branchService.branchId, [...branchIds]), serviceFilter(speciesId, categoryIds)),
    )
    .orderBy(asc(serviceCategory.sortOrder), asc(branchService.sortOrder), asc(branchService.name));
  const byBranch = groupBy(rows, (row) => row.branchId);
  return new Map(
    [...byBranch].map(([id, list]) => [
      id,
      list.slice(0, MAX_MATCHED_SERVICES).map((row) => row.id),
    ]),
  );
}

interface Hours {
  weekly: { dayOfWeek: number; opensAt: string; closesAt: string }[];
  exceptions: {
    date: string;
    isClosed: boolean;
    intervals: { opensAt: string; closesAt: string }[];
    note: string | null;
  }[];
}

/** Weekly hours and the exceptions from yesterday (its overnight shift may still run, D28) to the lookahead. */
async function loadHours(
  db: Db,
  branchIds: readonly string[],
  now: Date,
): Promise<Map<string, Hours>> {
  const hours = new Map<string, Hours>();
  if (branchIds.length === 0) return hours;
  const today = toManila(now).date;
  const ids = [...branchIds];
  const [weekly, exceptions] = await Promise.all([
    db
      .select()
      .from(branchHours)
      .where(inArray(branchHours.branchId, ids))
      .orderBy(asc(branchHours.dayOfWeek), asc(branchHours.opensAt)),
    db
      .select()
      .from(branchHoursException)
      .where(
        and(
          inArray(branchHoursException.branchId, ids),
          gte(branchHoursException.date, addDays(today, -1)),
          lte(branchHoursException.date, addDays(today, LOOKAHEAD_DAYS)),
        ),
      )
      .orderBy(asc(branchHoursException.date)),
  ]);
  const weeklyBy = groupBy(weekly, (row) => row.branchId);
  const exceptionsBy = groupBy(exceptions, (row) => row.branchId);
  for (const id of ids) {
    hours.set(id, {
      weekly: (weeklyBy.get(id) ?? []).map(({ dayOfWeek, opensAt, closesAt }) => ({
        dayOfWeek,
        opensAt: hhmm(opensAt),
        closesAt: hhmm(closesAt),
      })),
      exceptions: (exceptionsBy.get(id) ?? []).map(({ date, isClosed, intervals, note }) => ({
        date,
        isClosed,
        intervals,
        note,
      })),
    });
  }
  return hours;
}

/** Hits of one document as per-word arrays. */
function tokenHits(hits: readonly Hit[], tokenCount: number): TokenHits {
  const own = Array.from({ length: tokenCount }, () => 0);
  const speciesHits = Array.from({ length: tokenCount }, () => false);
  for (const hit of hits) {
    own[hit.ord] = hit.own;
    speciesHits[hit.ord] = hit.species;
  }
  return { own, species: speciesHits };
}

interface Ranked {
  candidate: Candidate;
  match: ListingMatch;
  emergency: EmergencyGroup | null;
  key: number[];
}

// ── Search ──────────────────────────────────────────────────────────────────────────────

export async function search(
  db: Db,
  query: SearchQuery,
  now: Date,
): Promise<{ response: SearchResponse; log: SearchLogEntry | null }> {
  const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
  const terms = searchTerms(query.q);
  const [tokens, { speciesId, categoryIds }] = await Promise.all([
    meaningfulTokens(db, terms.tokens),
    resolveFilters(db, query),
  ]);
  const openNow = query.openNow === 'true';
  const emergency = query.emergency === 'true';

  const candidates = await findCandidates(db, query, speciesId, categoryIds);
  const ids = candidates.map((candidate) => candidate.id);
  const [hits, matchedCategories, fillServices, filterHours] = await Promise.all([
    findHits(db, tokens, ids, speciesId, categoryIds),
    findMatchedCategories(db, tokens),
    categoryIds === null
      ? new Map<string, string[]>()
      : categoryServices(db, ids, speciesId, categoryIds),
    // Hours are only needed for every candidate when a filter depends on them.
    openNow || emergency ? loadHours(db, ids, now) : null,
  ]);

  const hitsByBranch = groupBy(hits, (hit) => hit.branchId);
  const ranked: Ranked[] = [];
  for (const candidate of candidates) {
    const branchHits = hitsByBranch.get(candidate.id) ?? [];
    const servicesHits = groupBy(
      branchHits.filter((hit) => hit.serviceId !== null),
      (hit) => hit.serviceId ?? '',
    );
    const found = matchListing({
      tokenCount: tokens.length,
      branch: tokenHits(
        branchHits.filter((hit) => hit.serviceId === null),
        tokens.length,
      ),
      services: [...servicesHits].map(([id, list]) => ({
        id,
        hits: tokenHits(list, tokens.length),
      })),
    });
    if (found === null) continue;
    // A category search always shows services: the branch's first ones in the category
    // when the words matched the branch itself (or there were none).
    const match =
      found.services.length === 0 && categoryIds !== null
        ? {
            ...found,
            services: (fillServices.get(candidate.id) ?? []).map((id) => ({ id, relevance: 0 })),
          }
        : found;

    let group: EmergencyGroup | null = null;
    if (filterHours !== null) {
      const hours = filterHours.get(candidate.id);
      const open =
        hours !== undefined &&
        isOpenNow(
          { is24h: candidate.is24h, weekly: hours.weekly, exceptions: hours.exceptions },
          now,
        );
      if (openNow && !open) continue;
      if (emergency) {
        if (open) group = 'open';
        else if (candidate.acceptsEmergencies && candidate.hasPhone) group = 'callable';
        else continue;
      }
    }

    const distanceKm = candidate.distanceM === null ? null : candidate.distanceM / 1000;
    const score = searchScore({
      relevance: match.relevance,
      distanceKm,
      verified: candidate.claimStatus === 'verified',
      freshness: freshness(candidate.hoursConfirmedAt, now).level,
      // hasHoursData() without loading the rows: 24h or any weekly hours.
      hasHours: candidate.is24h || candidate.hasWeekly,
    });
    ranked.push({
      candidate,
      match,
      emergency: group,
      key: searchSortKey(score, group === null ? null : { group, distanceKm }),
    });
  }

  ranked.sort(
    (a, b) =>
      compareSortKeys(a.key, b.key) ||
      (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0),
  );
  const after =
    cursor === null
      ? ranked
      : ranked.filter((item) => {
          const order = compareSortKeys(item.key, cursor.k);
          return order > 0 || (order === 0 && item.candidate.id > cursor.id);
        });
  const page = after.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor =
    after.length > query.limit && last !== undefined
      ? encodeCursor({ k: last.key, id: last.candidate.id })
      : null;

  const results = await pageResults(db, page, filterHours, now);
  return {
    response: { results, total: ranked.length, nextCursor, matchedCategories },
    // Only the first page is a new search.
    log:
      cursor === null
        ? {
            query: terms.query,
            filters: {
              ...(query.species !== undefined && { species: query.species }),
              ...(query.category !== undefined && { category: query.category }),
              ...(openNow && { openNow }),
              ...(emergency && { emergency }),
              ...(query.radiusKm !== undefined && { radiusKm: query.radiusKm }),
            },
            area:
              query.lat !== undefined && query.lng !== undefined
                ? `${query.lat.toFixed(2)},${query.lng.toFixed(2)}`
                : (query.cityCode ?? null),
            resultCount: ranked.length,
          }
        : null,
  };
}

/** Everything a result card shows, for one page of ranked branches. */
async function pageResults(
  db: Db,
  page: readonly Ranked[],
  loadedHours: Map<string, Hours> | null,
  now: Date,
): Promise<SearchResult[]> {
  if (page.length === 0) return [];
  const ids = page.map((item) => item.candidate.id);
  const serviceIds = page.flatMap((item) => item.match.services.map((service) => service.id));

  const [hours, contacts, treated, services, places] = await Promise.all([
    loadedHours ?? loadHours(db, ids, now),
    db
      .select({
        branchId: branchContact.branchId,
        type: branchContact.type,
        value: branchContact.value,
      })
      .from(branchContact)
      .where(
        and(
          inArray(branchContact.branchId, ids),
          inArray(branchContact.type, ['phone', 'messenger']),
        ),
      )
      .orderBy(asc(branchContact.sortOrder), asc(branchContact.id)),
    db
      .select({ branchId: branchSpecies.branchId, code: species.code, name: species.name })
      .from(branchSpecies)
      .innerJoin(species, eq(species.id, branchSpecies.speciesId))
      .where(inArray(branchSpecies.branchId, ids))
      .orderBy(asc(species.sortOrder), asc(species.name)),
    serviceIds.length === 0 ? [] : listServices(db, inArray(branchService.id, serviceIds)),
    publicBranchPlacesByBusiness(db, [...new Set(page.map((item) => item.candidate.businessId))]),
  ]);

  const speciesIds = [...new Set(services.flatMap((service) => service.speciesIds))];
  const speciesNames = new Map(
    speciesIds.length === 0
      ? []
      : (
          await db
            .select({ id: species.id, name: species.name })
            .from(species)
            .where(inArray(species.id, speciesIds))
        ).map((row) => [row.id, row.name]),
  );
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const contactsBy = groupBy(contacts, (row) => row.branchId);
  const speciesBy = groupBy(treated, (row) => row.branchId);

  return page.map(({ candidate: c, match, emergency }) => {
    const path = listingPaths(c.businessSlug, places.get(c.businessId) ?? [])?.branches.get(c.id);
    if (path === undefined) throw new Error(`branch ${c.id} has no public path`);
    const branchContacts = contactsBy.get(c.id) ?? [];
    const base = {
      business: {
        id: c.businessId,
        slug: c.businessSlug,
        name: c.businessName,
        claimStatus: c.claimStatus,
      },
      branch: {
        id: c.id,
        name: c.name,
        path,
        addressLine: c.addressLine,
        barangay: c.barangayName === null ? null : { name: c.barangayName },
        city: { name: c.cityName },
        location: c.location,
        is24h: c.is24h,
        acceptsEmergencies: c.acceptsEmergencies,
        hoursConfirmedAt: c.hoursConfirmedAt?.toISOString() ?? null,
        hoursConfirmedBy: c.hoursConfirmedBy,
        weekly: hours.get(c.id)?.weekly ?? [],
        exceptions: hours.get(c.id)?.exceptions ?? [],
        species: (speciesBy.get(c.id) ?? []).map(({ code, name }) => ({ code, name })),
        phone: branchContacts.find((row) => row.type === 'phone')?.value ?? null,
        messenger: branchContacts.find((row) => row.type === 'messenger')?.value ?? null,
      },
      distanceM: c.distanceM === null ? null : Math.round(c.distanceM),
      emergency,
    };
    const shown = match.services.flatMap(({ id }) => {
      const service = servicesById.get(id);
      return service === undefined
        ? []
        : [
            {
              id: service.id,
              name: service.name,
              category: { name: service.category.name, groupName: service.category.groupName },
              priceMin: service.priceMin,
              priceMax: service.priceMax,
              priceUnit: service.priceUnit,
              priceNote: service.priceNote,
              species: service.speciesIds.flatMap((speciesId) => speciesNames.get(speciesId) ?? []),
            },
          ];
    });
    return shown.length === 0
      ? { ...base, kind: 'branch' as const }
      : { ...base, kind: 'service' as const, services: shown };
  });
}

/** Writes the search_log row for a first page (no personal data, ARCHITECTURE §6). */
export async function recordSearch(db: Db, entry: SearchLogEntry): Promise<void> {
  await db.insert(searchLog).values(entry);
}
