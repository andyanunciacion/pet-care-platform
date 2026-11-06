import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { SLUG_PATTERN } from '@paw/domain';
import { and, asc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { diffFields, recordAudit } from '../audit.ts';
import { isUniqueViolation } from '../db-errors.ts';
import { httpError } from '../errors.ts';

const { business, branch, psgcArea } = schema;

export const BUSINESS_TYPES = schema.businessType.enumValues;
export const CLAIM_STATUSES = schema.claimStatus.enumValues;
export const LISTING_STATUSES = schema.listingStatus.enumValues;

// ── Input schemas (shared by the business and branch routes) ────────────────────────────

export const SlugSchema = z
  .string()
  .trim()
  .max(80)
  .regex(
    new RegExp(SLUG_PATTERN),
    'Use lowercase letters, digits and single hyphens, e.g. "paw-vet-clinic".',
  );

export const NameSchema = z.string().trim().min(1, 'Enter a name.').max(200);

/** Optional free text: an empty string is stored as null (see emptyToNull). */
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export function emptyToNull(value: string | null): string | null {
  return value === null || value === '' ? null : value;
}

const businessFields = {
  name: NameSchema,
  slug: SlugSchema,
  description: optionalText(5000),
  /** Where PAW got the data, e.g. "Clinic visit", "Facebook page". */
  dataSource: optionalText(500),
  listingStatus: z.enum(LISTING_STATUSES),
};

export const CreateBusinessSchema = z.object({
  ...businessFields,
  type: z.enum(BUSINESS_TYPES),
  description: businessFields.description.default(null),
  dataSource: businessFields.dataSource.default(null),
  // New listings start hidden, so a half-filled one never goes public by accident.
  listingStatus: businessFields.listingStatus.default('hidden'),
});

/**
 * Only the fields sent are changed. The type can't change (its rules shape the branches),
 * and claim status belongs to the claim flow (P1-8).
 */
export const UpdateBusinessSchema = z.object(businessFields).partial();

export const ListBusinessesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cityCode: z
    .string()
    .regex(/^[0-9]{10}$/)
    .optional(),
  claimStatus: z.enum(CLAIM_STATUSES).optional(),
  listingStatus: z.enum(LISTING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Response schemas ────────────────────────────────────────────────────────────────────

export const AreaSchema = z.object({ code: z.string(), name: z.string() });

export const BusinessSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(BUSINESS_TYPES),
  description: z.string().nullable(),
  claimStatus: z.enum(CLAIM_STATUSES),
  listingStatus: z.enum(LISTING_STATUSES),
  dataSource: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const BusinessDetailSchema = BusinessSchema.extend({
  branches: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      addressLine: z.string(),
      city: AreaSchema,
      listingStatus: z.enum(LISTING_STATUSES),
      updatedAt: z.iso.datetime(),
    }),
  ),
});

export const BusinessListSchema = z.object({
  items: z.array(
    BusinessSchema.pick({
      id: true,
      name: true,
      slug: true,
      type: true,
      claimStatus: true,
      listingStatus: true,
      updatedAt: true,
    }).extend({
      branchCount: z.number().int(),
      /** The cities its branches are in, by name. */
      cities: z.array(AreaSchema),
    }),
  ),
  total: z.number().int(),
});

type BusinessRow = typeof business.$inferSelect;
export type Business = z.infer<typeof BusinessSchema>;

/** The fields audit_log records for a business. */
const AUDITED_FIELDS = [
  'name',
  'slug',
  'type',
  'description',
  'dataSource',
  'claimStatus',
  'listingStatus',
] as const satisfies readonly (keyof BusinessRow)[];

function toBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
    claimStatus: row.claimStatus,
    listingStatus: row.listingStatus,
    dataSource: row.dataSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function slugTaken() {
  return httpError(409, 'Another business already uses this slug.', [
    { pointer: '/slug', message: 'Another business already uses this slug.' },
  ]);
}

export const businessNotFound = () => httpError(404, 'No business with that id.');

/** Escapes LIKE wildcards, so a search for "50%" matches the text "50%". */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

// ── Queries ─────────────────────────────────────────────────────────────────────────────

export async function listBusinesses(
  db: Db,
  query: z.infer<typeof ListBusinessesQuerySchema>,
): Promise<z.infer<typeof BusinessListSchema>> {
  const branchWhere = (condition: SQL) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(branch)
        .where(and(eq(branch.businessId, business.id), condition)),
    );

  const pattern = query.q === undefined || query.q === '' ? null : `%${escapeLike(query.q)}%`;
  const where = and(
    pattern === null
      ? undefined
      : or(ilike(business.name, pattern), branchWhere(ilike(branch.name, pattern))),
    query.cityCode === undefined ? undefined : branchWhere(eq(branch.cityCode, query.cityCode)),
    query.claimStatus === undefined ? undefined : eq(business.claimStatus, query.claimStatus),
    query.listingStatus === undefined ? undefined : eq(business.listingStatus, query.listingStatus),
  );

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(business)
      .where(where)
      .orderBy(asc(business.name), asc(business.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.$count(business, where),
  ]);

  const ids = rows.map((row) => row.id);
  const branches =
    ids.length === 0
      ? []
      : await db
          .select({ businessId: branch.businessId, code: psgcArea.code, name: psgcArea.name })
          .from(branch)
          .innerJoin(psgcArea, eq(psgcArea.code, branch.cityCode))
          .where(inArray(branch.businessId, ids))
          .orderBy(asc(psgcArea.name));

  return {
    items: rows.map((row) => {
      const own = branches.filter((b) => b.businessId === row.id);
      const cities = new Map(own.map((b) => [b.code, { code: b.code, name: b.name }]));
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        claimStatus: row.claimStatus,
        listingStatus: row.listingStatus,
        updatedAt: row.updatedAt.toISOString(),
        branchCount: own.length,
        cities: [...cities.values()],
      };
    }),
    total,
  };
}

export async function getBusiness(
  db: Db,
  id: string,
): Promise<z.infer<typeof BusinessDetailSchema>> {
  const [row] = await db.select().from(business).where(eq(business.id, id));
  if (row === undefined) throw businessNotFound();

  const branches = await db
    .select({
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      addressLine: branch.addressLine,
      cityCode: psgcArea.code,
      cityName: psgcArea.name,
      listingStatus: branch.listingStatus,
      updatedAt: branch.updatedAt,
    })
    .from(branch)
    .innerJoin(psgcArea, eq(psgcArea.code, branch.cityCode))
    .where(eq(branch.businessId, id))
    .orderBy(asc(branch.name), asc(branch.id));

  return {
    ...toBusiness(row),
    branches: branches.map(({ cityCode, cityName, updatedAt, ...rest }) => ({
      ...rest,
      city: { code: cityCode, name: cityName },
      updatedAt: updatedAt.toISOString(),
    })),
  };
}

// ── Writes (each one records an audit_log entry in the same transaction) ────────────────

export async function createBusiness(
  db: Db,
  actorId: string,
  input: z.infer<typeof CreateBusinessSchema>,
): Promise<Business> {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(business)
        .values({
          ...input,
          description: emptyToNull(input.description),
          dataSource: emptyToNull(input.dataSource),
        })
        .returning();
      if (row === undefined) throw new Error('insert returned no row');

      await recordAudit(tx, {
        actorId,
        action: 'business.create',
        entityType: 'business',
        entityId: row.id,
        diff: diffFields(null, row, AUDITED_FIELDS),
      });
      return toBusiness(row);
    });
  } catch (error) {
    if (isUniqueViolation(error, 'business_slug_unique')) throw slugTaken();
    throw error;
  }
}

export async function updateBusiness(
  db: Db,
  actorId: string,
  id: string,
  patch: z.infer<typeof UpdateBusinessSchema>,
): Promise<Business> {
  const changes = {
    ...patch,
    ...(patch.description !== undefined && { description: emptyToNull(patch.description) }),
    ...(patch.dataSource !== undefined && { dataSource: emptyToNull(patch.dataSource) }),
  };

  try {
    return await db.transaction(async (tx) => {
      // FOR UPDATE: a concurrent save waits, so each audit entry's "from" is accurate.
      const [before] = await tx.select().from(business).where(eq(business.id, id)).for('update');
      if (before === undefined) throw businessNotFound();

      const diff = diffFields(before, { ...before, ...changes }, AUDITED_FIELDS);
      if (Object.keys(diff).length === 0) return toBusiness(before);

      const [row] = await tx.update(business).set(changes).where(eq(business.id, id)).returning();
      if (row === undefined) throw new Error('update returned no row');

      await recordAudit(tx, {
        actorId,
        action: 'business.update',
        entityType: 'business',
        entityId: id,
        diff,
      });
      return toBusiness(row);
    });
  } catch (error) {
    if (isUniqueViolation(error, 'business_slug_unique')) throw slugTaken();
    throw error;
  }
}
