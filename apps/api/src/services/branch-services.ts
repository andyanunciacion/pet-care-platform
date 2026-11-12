// A branch's services with estimated prices (DESIGN UX10), the species each one covers, and
// the species the branch treats. Writes are audited on the branch (ARCHITECTURE D36), and
// "copy to all branches" overwrites a same-named service in the same category (D37).
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { MAX_PRICE_CENTAVOS } from '@paw/domain';
import { and, asc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { diffFields, recordAudit, type AuditDiff, type Tx } from '../audit.ts';
import { httpError } from '../errors.ts';
import { lockBranch } from './branch-hours.ts';
import { branchNotFound } from './branches.ts';
import { emptyToNull, NameSchema } from './businesses.ts';

const { branch, branchService, branchServiceSpecies, branchSpecies, serviceCategory, species } =
  schema;

/** A category's parent ("Surgery" for "Spay / neuter"): the same table, joined a second time. */
const categoryGroup = alias(serviceCategory, 'category_group');

export const PRICE_UNITS = schema.priceUnit.enumValues;

// ── Input schemas ───────────────────────────────────────────────────────────────────────

const SpeciesIdsSchema = z.array(z.uuid()).max(50);

/** In centavos (CLAUDE.md: money is integer centavos). */
const PriceSchema = z
  .int()
  .min(0, "A price can't be negative.")
  .max(MAX_PRICE_CENTAVOS, "That's over ₱1,000,000. Check for an extra zero.")
  .nullable();

const optionalText = (max: number) => z.string().trim().max(max).nullable();

const serviceFields = {
  /** A subcategory ("Spay / neuter"), not a group ("Surgery"). */
  categoryId: z.uuid(),
  name: NameSchema,
  /** What the service includes, shown under its name. */
  description: optionalText(2000),
  /** Both set: a range. Only the minimum: "From …". Neither: "Call for price". */
  priceMin: PriceSchema,
  priceMax: PriceSchema,
  priceUnit: z.enum(PRICE_UNITS),
  /** e.g. "Depends on weight", "Includes anesthesia". */
  priceNote: optionalText(200),
  /** The species the service covers (D25). */
  speciesIds: SpeciesIdsSchema,
};

export const CreateServiceSchema = z.object({
  ...serviceFields,
  description: serviceFields.description.default(null),
  priceMin: serviceFields.priceMin.default(null),
  priceMax: serviceFields.priceMax.default(null),
  priceUnit: serviceFields.priceUnit.default('per_visit'),
  priceNote: serviceFields.priceNote.default(null),
  speciesIds: serviceFields.speciesIds.default([]),
});

/** Only the fields sent are changed; `speciesIds` replaces the list. */
export const UpdateServiceSchema = z.object(serviceFields).partial();

/** The whole list; it replaces the current one. */
export const SetSpeciesTreatedSchema = z.object({ speciesIds: SpeciesIdsSchema });

/** `dryRun: true` only reports what a copy would do (for the confirmation). */
export const CopyServiceSchema = z.object({ dryRun: z.boolean() });

type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

// ── Response schemas ────────────────────────────────────────────────────────────────────

export const ServiceSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid(),
  category: z.object({
    id: z.uuid(),
    name: z.string(),
    /** The parent group, e.g. "Surgery". */
    groupName: z.string().nullable(),
  }),
  name: z.string(),
  description: z.string().nullable(),
  priceMin: z.int().nullable(),
  priceMax: z.int().nullable(),
  priceUnit: z.enum(PRICE_UNITS),
  priceNote: z.string().nullable(),
  /** In the species' display order. */
  speciesIds: z.array(z.uuid()),
  updatedAt: z.iso.datetime(),
});

const BranchRefSchema = z.object({ id: z.uuid(), name: z.string() });

export const BranchServicesSchema = z.object({
  branchId: z.uuid(),
  businessId: z.uuid(),
  /** The business's other branches, by name: the targets of "copy to all branches". */
  otherBranches: z.array(BranchRefSchema),
  /** "Species treated" on the clinic page, in display order. */
  speciesTreated: z.array(z.uuid()),
  /** By category group, then category, then the order they were added. */
  services: z.array(ServiceSchema),
});

const CopyTargetSchema = BranchRefSchema.extend({
  /**
   * The service's species the branch didn't treat yet, by name: the copy adds them to its
   * "Species treated", so a branch never offers a service for animals it doesn't list.
   */
  speciesAdded: z.array(z.string()),
});

export const CopyServiceResultSchema = z.object({
  dryRun: z.boolean(),
  /** Branches that get a new copy, by name. */
  added: z.array(CopyTargetSchema),
  /** Branches whose same-named service in the same category is overwritten. */
  updated: z.array(CopyTargetSchema),
  /** Branches whose matching service is already identical (they may still gain species). */
  unchanged: z.array(CopyTargetSchema),
});

export type Service = z.infer<typeof ServiceSchema>;
export type BranchServices = z.infer<typeof BranchServicesSchema>;
export type CopyServiceResult = z.infer<typeof CopyServiceResultSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────────────────────

export const serviceNotFound = () => httpError(404, 'No service with that id.');

/** The editable values of a service, compared to decide what changed. */
interface ServiceValues {
  categoryId: string;
  name: string;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: (typeof PRICE_UNITS)[number];
  priceNote: string | null;
  /** Sorted, so the same set always compares equal. */
  speciesIds: string[];
}

const SERVICE_FIELDS = [
  'categoryId',
  'name',
  'description',
  'priceMin',
  'priceMax',
  'priceUnit',
  'priceNote',
  'speciesIds',
] as const satisfies readonly (keyof ServiceValues)[];

function serviceValues(
  row: Omit<ServiceValues, 'speciesIds'>,
  speciesIds: readonly string[],
): ServiceValues {
  return {
    categoryId: row.categoryId,
    name: row.name,
    description: emptyToNull(row.description),
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    priceUnit: row.priceUnit,
    priceNote: emptyToNull(row.priceNote),
    speciesIds: [...new Set(speciesIds)].sort(),
  };
}

const hasChanges = (before: ServiceValues, after: ServiceValues) =>
  Object.keys(diffFields(before, after, SERVICE_FIELDS)).length > 0;

/** Species ids per service, in the species' display order. */
async function speciesIdsByService(
  db: Pick<Db, 'select'>,
  serviceIds: readonly string[],
): Promise<Map<string, string[]>> {
  const byService = new Map<string, string[]>();
  if (serviceIds.length === 0) return byService;
  const rows = await db
    .select({
      serviceId: branchServiceSpecies.branchServiceId,
      speciesId: branchServiceSpecies.speciesId,
    })
    .from(branchServiceSpecies)
    .innerJoin(species, eq(species.id, branchServiceSpecies.speciesId))
    .where(inArray(branchServiceSpecies.branchServiceId, [...serviceIds]))
    .orderBy(asc(species.sortOrder), asc(species.name));
  for (const { serviceId, speciesId } of rows) {
    byService.set(serviceId, [...(byService.get(serviceId) ?? []), speciesId]);
  }
  return byService;
}

/** Services matching `condition`, by category group, then category, then the order added. */
export async function listServices(db: Pick<Db, 'select'>, condition: SQL): Promise<Service[]> {
  const rows = await db
    .select({
      service: branchService,
      categoryName: serviceCategory.name,
      groupName: categoryGroup.name,
    })
    .from(branchService)
    .innerJoin(serviceCategory, eq(serviceCategory.id, branchService.categoryId))
    .leftJoin(categoryGroup, eq(categoryGroup.id, serviceCategory.parentId))
    .where(condition)
    .orderBy(
      asc(categoryGroup.sortOrder),
      asc(serviceCategory.sortOrder),
      asc(branchService.sortOrder),
      asc(branchService.name),
    );
  const speciesIds = await speciesIdsByService(
    db,
    rows.map((row) => row.service.id),
  );

  return rows.map(({ service: s, categoryName, groupName }) => ({
    id: s.id,
    branchId: s.branchId,
    category: { id: s.categoryId, name: categoryName, groupName },
    name: s.name,
    description: s.description,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    priceUnit: s.priceUnit,
    priceNote: s.priceNote,
    speciesIds: speciesIds.get(s.id) ?? [],
    updatedAt: s.updatedAt.toISOString(),
  }));
}

/** Species names in display order: audit entries store names, so the history stays readable. */
async function speciesNames(tx: Tx, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await tx
    .select({ name: species.name })
    .from(species)
    .where(inArray(species.id, [...ids]))
    .orderBy(asc(species.sortOrder), asc(species.name));
  return rows.map((row) => row.name);
}

/** What audit_log records for a service: names instead of ids. */
async function auditService(tx: Tx, values: ServiceValues) {
  const [category] = await tx
    .select({ name: serviceCategory.name })
    .from(serviceCategory)
    .where(eq(serviceCategory.id, values.categoryId));
  return {
    category: category?.name ?? null,
    name: values.name,
    description: values.description,
    priceMin: values.priceMin,
    priceMax: values.priceMax,
    priceUnit: values.priceUnit,
    priceNote: values.priceNote,
    species: await speciesNames(tx, values.speciesIds),
  };
}

// ── Rules checked against the database ──────────────────────────────────────────────────

/** Services use the nested categories ("Vaccination"), not the groups ("Preventive care"). */
async function assertCategory(tx: Tx, categoryId: string): Promise<void> {
  const [row] = await tx
    .select({ parentId: serviceCategory.parentId })
    .from(serviceCategory)
    .where(eq(serviceCategory.id, categoryId));
  if (row === undefined) {
    const message = 'Pick a service category.';
    throw httpError(400, message, [{ pointer: '/categoryId', message }]);
  }
  if (row.parentId === null) {
    const message = 'Pick a specific service, e.g. Vaccination under Preventive care.';
    throw httpError(400, message, [{ pointer: '/categoryId', message }]);
  }
}

async function assertSpecies(tx: Tx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: species.id })
    .from(species)
    .where(inArray(species.id, [...ids]));
  if (rows.length !== ids.length) {
    const message = 'One of the species no longer exists. Reload the page.';
    throw httpError(400, message, [{ pointer: '/speciesIds', message }]);
  }
}

/** The database checks this too; checking first gives the form a message on the right field. */
function assertPriceRange({ priceMin, priceMax }: Pick<ServiceValues, 'priceMin' | 'priceMax'>) {
  if (priceMax === null) return;
  if (priceMin === null) {
    const message = 'With one price, put it in the first box ("From ₱…").';
    throw httpError(400, message, [{ pointer: '/priceMax', message }]);
  }
  if (priceMax < priceMin) {
    const message = 'The highest price is below the lowest.';
    throw httpError(400, message, [{ pointer: '/priceMax', message }]);
  }
}

async function replaceServiceSpecies(tx: Tx, serviceId: string, speciesIds: readonly string[]) {
  await tx.delete(branchServiceSpecies).where(eq(branchServiceSpecies.branchServiceId, serviceId));
  if (speciesIds.length === 0) return;
  await tx
    .insert(branchServiceSpecies)
    .values(speciesIds.map((speciesId) => ({ branchServiceId: serviceId, speciesId })));
}

/** New services go last in their category. */
async function nextSortOrder(tx: Tx, branchId: string): Promise<number> {
  const [row] = await tx
    .select({
      next: sql`coalesce(max(${branchService.sortOrder}), -1) + 1`.mapWith(Number),
    })
    .from(branchService)
    .where(eq(branchService.branchId, branchId));
  return row?.next ?? 0;
}

/** The branch's public page changes with its services: touch its updated_at. */
async function touchBranch(tx: Tx, branchId: string) {
  await tx.update(branch).set({ updatedAt: new Date() }).where(eq(branch.id, branchId));
}

/** Inserts a service and its species links. */
async function insertService(tx: Tx, branchId: string, values: ServiceValues): Promise<string> {
  const { speciesIds, ...fields } = values;
  const [row] = await tx
    .insert(branchService)
    .values({ ...fields, branchId, sortOrder: await nextSortOrder(tx, branchId) })
    .returning({ id: branchService.id });
  if (row === undefined) throw new Error('insert returned no row');
  await replaceServiceSpecies(tx, row.id, speciesIds);
  return row.id;
}

/** Overwrites a service with new values (both already checked). */
async function overwriteService(tx: Tx, serviceId: string, values: ServiceValues) {
  const { speciesIds, ...fields } = values;
  await tx
    .update(branchService)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(branchService.id, serviceId));
  await replaceServiceSpecies(tx, serviceId, speciesIds);
}

/** Locks the service's branch, then reads the service (and its species) for a write. */
async function lockService(tx: Tx, serviceId: string) {
  const [found] = await tx
    .select({ branchId: branchService.branchId })
    .from(branchService)
    .where(eq(branchService.id, serviceId));
  if (found === undefined) throw serviceNotFound();
  await lockBranch(tx, found.branchId);

  // Read again under the lock: a concurrent delete may have won.
  const [row] = await tx.select().from(branchService).where(eq(branchService.id, serviceId));
  if (row === undefined) throw serviceNotFound();
  const speciesIds = (await speciesIdsByService(tx, [serviceId])).get(serviceId) ?? [];
  return { row, values: serviceValues(row, speciesIds) };
}

// ── Queries ─────────────────────────────────────────────────────────────────────────────

/** Takes the database or a transaction (writes read their result back inside theirs). */
export async function getBranchServices(
  db: Pick<Db, 'select'>,
  branchId: string,
): Promise<BranchServices> {
  const [row] = await db
    .select({ businessId: branch.businessId })
    .from(branch)
    .where(eq(branch.id, branchId));
  if (row === undefined) throw branchNotFound();

  const [otherBranches, treated, services] = await Promise.all([
    db
      .select({ id: branch.id, name: branch.name })
      .from(branch)
      .where(and(eq(branch.businessId, row.businessId), ne(branch.id, branchId)))
      .orderBy(asc(branch.name)),
    db
      .select({ speciesId: branchSpecies.speciesId })
      .from(branchSpecies)
      .innerJoin(species, eq(species.id, branchSpecies.speciesId))
      .where(eq(branchSpecies.branchId, branchId))
      .orderBy(asc(species.sortOrder), asc(species.name)),
    listServices(db, eq(branchService.branchId, branchId)),
  ]);

  return {
    branchId,
    businessId: row.businessId,
    otherBranches,
    speciesTreated: treated.map((t) => t.speciesId),
    services,
  };
}

export async function getService(db: Pick<Db, 'select'>, serviceId: string): Promise<Service> {
  const [service] = await listServices(db, eq(branchService.id, serviceId));
  if (service === undefined) throw serviceNotFound();
  return service;
}

// ── Writes (each one records an audit_log entry in the same transaction) ────────────────

export async function setSpeciesTreated(
  db: Db,
  actorId: string,
  branchId: string,
  input: z.infer<typeof SetSpeciesTreatedSchema>,
): Promise<BranchServices> {
  return db.transaction(async (tx) => {
    await lockBranch(tx, branchId);
    const speciesIds = [...new Set(input.speciesIds)];
    await assertSpecies(tx, speciesIds);

    const before = await tx
      .select({ speciesId: branchSpecies.speciesId })
      .from(branchSpecies)
      .where(eq(branchSpecies.branchId, branchId));
    const diff = diffFields(
      {
        speciesTreated: await speciesNames(
          tx,
          before.map((row) => row.speciesId),
        ),
      },
      { speciesTreated: await speciesNames(tx, speciesIds) },
      ['speciesTreated'],
    );
    if (Object.keys(diff).length === 0) return getBranchServices(tx, branchId);

    await tx.delete(branchSpecies).where(eq(branchSpecies.branchId, branchId));
    if (speciesIds.length > 0) {
      await tx
        .insert(branchSpecies)
        .values(speciesIds.map((speciesId) => ({ branchId, speciesId })));
    }
    await touchBranch(tx, branchId);

    await recordAudit(tx, {
      actorId,
      action: 'branch.update_species',
      entityType: 'branch',
      entityId: branchId,
      diff,
    });
    return getBranchServices(tx, branchId);
  });
}

export async function createService(
  db: Db,
  actorId: string,
  branchId: string,
  input: CreateServiceInput,
): Promise<Service> {
  return db.transaction(async (tx) => {
    await lockBranch(tx, branchId);
    const values = serviceValues(input, input.speciesIds);
    await assertCategory(tx, values.categoryId);
    await assertSpecies(tx, values.speciesIds);
    assertPriceRange(values);

    const id = await insertService(tx, branchId, values);
    await touchBranch(tx, branchId);

    await recordAudit(tx, {
      actorId,
      action: 'branch.create_service',
      entityType: 'branch',
      entityId: branchId,
      diff: diffFields(null, { service: await auditService(tx, values) }, ['service']),
    });
    return getService(tx, id);
  });
}

export async function updateService(
  db: Db,
  actorId: string,
  serviceId: string,
  patch: UpdateServiceInput,
): Promise<Service> {
  return db.transaction(async (tx) => {
    const { row, values: before } = await lockService(tx, serviceId);
    const { speciesIds, ...changes } = patch;
    const after = serviceValues({ ...before, ...changes }, speciesIds ?? before.speciesIds);

    const changed = diffFields(before, after, SERVICE_FIELDS);
    if (Object.keys(changed).length === 0) return getService(tx, serviceId);
    if ('categoryId' in changed) await assertCategory(tx, after.categoryId);
    if ('speciesIds' in changed) await assertSpecies(tx, after.speciesIds);
    assertPriceRange(after);

    await overwriteService(tx, serviceId, after);
    await touchBranch(tx, row.branchId);

    await recordAudit(tx, {
      actorId,
      action: 'branch.update_service',
      entityType: 'branch',
      entityId: row.branchId,
      diff: diffFields(
        { service: await auditService(tx, before) },
        { service: await auditService(tx, after) },
        ['service'],
      ),
    });
    return getService(tx, serviceId);
  });
}

export async function deleteService(db: Db, actorId: string, serviceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { row, values } = await lockService(tx, serviceId);
    // Read the audit values first: deleting the service deletes its species links (cascade).
    const removed = await auditService(tx, values);
    await tx.delete(branchService).where(eq(branchService.id, serviceId));
    await touchBranch(tx, row.branchId);

    await recordAudit(tx, {
      actorId,
      action: 'branch.delete_service',
      entityType: 'branch',
      entityId: row.branchId,
      diff: { service: { from: removed, to: null } },
    });
  });
}

/**
 * Copies a service to the business's other branches (D37). A branch that already has a
 * service in the same category with the same name (ignoring case and outer spaces) gets it
 * overwritten; the others get a new copy. Each branch also gains the service's species in
 * its "Species treated". With `dryRun`, nothing is written: the result is what the
 * confirmation shows.
 */
export async function copyServiceToBranches(
  db: Db,
  actorId: string,
  serviceId: string,
  { dryRun }: z.infer<typeof CopyServiceSchema>,
): Promise<CopyServiceResult> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select({ service: branchService, businessId: branch.businessId })
      .from(branchService)
      .innerJoin(branch, eq(branch.id, branchService.branchId))
      .where(eq(branchService.id, serviceId));
    if (source === undefined) throw serviceNotFound();
    const sourceSpecies = (await speciesIdsByService(tx, [serviceId])).get(serviceId) ?? [];
    const values = serviceValues(source.service, sourceSpecies);

    const targetsQuery = tx
      .select({ id: branch.id, name: branch.name })
      .from(branch)
      .where(and(eq(branch.businessId, source.businessId), ne(branch.id, source.service.branchId)))
      // Always lock in id order, so two copies running at once can't deadlock.
      .orderBy(asc(branch.id));
    const targets = dryRun ? await targetsQuery : await targetsQuery.for('update');

    const result: CopyServiceResult = { dryRun, added: [], updated: [], unchanged: [] };
    for (const branchRef of targets) {
      // The service's species this branch doesn't treat yet (in the source's species order).
      const treated = (
        await tx
          .select({ speciesId: branchSpecies.speciesId })
          .from(branchSpecies)
          .where(eq(branchSpecies.branchId, branchRef.id))
      ).map((row) => row.speciesId);
      const missingSpecies = values.speciesIds.filter((id) => !treated.includes(id));
      const target = { ...branchRef, speciesAdded: await speciesNames(tx, missingSpecies) };

      const [match] = await tx
        .select()
        .from(branchService)
        .where(
          and(
            eq(branchService.branchId, target.id),
            eq(branchService.categoryId, values.categoryId),
            sql`lower(btrim(${branchService.name})) = lower(btrim(${values.name}))`,
          ),
        )
        .orderBy(asc(branchService.sortOrder), asc(branchService.id))
        .limit(1);

      const before =
        match === undefined
          ? null
          : serviceValues(match, (await speciesIdsByService(tx, [match.id])).get(match.id) ?? []);
      const outcome =
        before === null ? 'added' : hasChanges(before, values) ? 'updated' : 'unchanged';
      result[outcome].push(target);
      if (dryRun || (outcome === 'unchanged' && missingSpecies.length === 0)) continue;

      // One audit entry per branch, with the service and the species it gained.
      const diff: AuditDiff = {};
      if (match === undefined) {
        await insertService(tx, target.id, values);
        Object.assign(
          diff,
          diffFields(null, { service: await auditService(tx, values) }, ['service']),
        );
      } else if (outcome === 'updated' && before !== null) {
        await overwriteService(tx, match.id, values);
        Object.assign(
          diff,
          diffFields(
            { service: await auditService(tx, before) },
            { service: await auditService(tx, values) },
            ['service'],
          ),
        );
      }
      if (missingSpecies.length > 0) {
        await tx
          .insert(branchSpecies)
          .values(missingSpecies.map((speciesId) => ({ branchId: target.id, speciesId })));
        diff.speciesTreated = {
          from: await speciesNames(tx, treated),
          to: await speciesNames(tx, [...treated, ...missingSpecies]),
        };
      }
      await touchBranch(tx, target.id);
      await recordAudit(tx, {
        actorId,
        action: 'branch.copy_service',
        entityType: 'branch',
        entityId: target.id,
        diff,
      });
    }

    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    result.added.sort(byName);
    result.updated.sort(byName);
    result.unchanged.sort(byName);
    return result;
  });
}
