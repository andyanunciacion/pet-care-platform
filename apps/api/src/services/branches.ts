import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { BUSINESS_TYPE_RULES, isInPhilippines, normalizePhPhone } from '@paw/domain';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { diffFields, recordAudit, type Tx } from '../audit.ts';
import { isUniqueViolation } from '../db-errors.ts';
import { httpError, type FieldError } from '../errors.ts';
import {
  AreaSchema,
  BUSINESS_TYPES,
  businessNotFound,
  emptyToNull,
  LISTING_STATUSES,
  NameSchema,
  SlugSchema,
} from './businesses.ts';

const { business, branch, branchContact, psgcArea } = schema;

const CONTACT_TYPES = schema.contactType.enumValues;
const HOURS_CONFIRMED_BY = schema.hoursConfirmedBy.enumValues;

// ── Input schemas ───────────────────────────────────────────────────────────────────────

const PsgcCodeSchema = z.string().regex(/^[0-9]{10}$/, 'Expected a 10-digit PSGC code.');

/** Accepts the ways clinics write numbers ("0917 123 4567") and stores E.164 (+63…). */
const PhoneSchema = z
  .string()
  .refine((value) => normalizePhPhone(value) !== null, {
    message: 'Enter a Philippine number, e.g. 0917 123 4567 or (045) 888 1234.',
  })
  .overwrite((value) => normalizePhPhone(value) ?? value);

/** Shown next to the value, e.g. "Globe", "Smart", "Landline". */
const LabelSchema = z.string().trim().max(50).nullable().default(null);

const ContactInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('phone'), value: PhoneSchema, label: LabelSchema }),
  z.object({ type: z.literal('viber'), value: PhoneSchema, label: LabelSchema }),
  z.object({
    type: z.literal('messenger'),
    value: z.url({ protocol: /^https?$/, error: 'Enter a link, e.g. https://m.me/yourclinic.' }),
    label: LabelSchema,
  }),
  z.object({ type: z.literal('email'), value: z.email(), label: LabelSchema }),
]);

const LocationSchema = z
  .object({ lng: z.number().min(-180).max(180), lat: z.number().min(-90).max(90) })
  .refine(isInPhilippines, {
    message:
      'The pin must be in the Philippines. Check that latitude and longitude are not swapped.',
  });

const branchFields = {
  name: NameSchema,
  slug: SlugSchema,
  /** Street, building, landmark. Barangay, city and province come from the PSGC codes. */
  addressLine: z.string().trim().min(1, 'Enter the street address.').max(300),
  provinceCode: PsgcCodeSchema,
  cityCode: PsgcCodeSchema,
  barangayCode: PsgcCodeSchema.nullable(),
  location: LocationSchema,
  is24h: z.boolean(),
  acceptsEmergencies: z.boolean(),
  listingStatus: z.enum(LISTING_STATUSES),
  /** The full list, in display order. On update it replaces the current list. */
  contacts: z.array(ContactInputSchema).max(20),
};

export const CreateBranchSchema = z.object({
  ...branchFields,
  barangayCode: branchFields.barangayCode.default(null),
  is24h: branchFields.is24h.default(false),
  acceptsEmergencies: branchFields.acceptsEmergencies.default(false),
  listingStatus: branchFields.listingStatus.default('published'),
  contacts: branchFields.contacts.default([]),
});

/** Only the fields sent are changed. */
export const UpdateBranchSchema = z.object(branchFields).partial();

type CreateBranchInput = z.infer<typeof CreateBranchSchema>;
type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;
type ContactInput = CreateBranchInput['contacts'][number];

// ── Response schema ─────────────────────────────────────────────────────────────────────

export const BranchSchema = z.object({
  id: z.uuid(),
  business: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    type: z.enum(BUSINESS_TYPES),
  }),
  name: z.string(),
  slug: z.string(),
  addressLine: z.string(),
  province: AreaSchema,
  city: AreaSchema,
  barangay: AreaSchema.nullable(),
  location: z.object({ lng: z.number(), lat: z.number() }),
  is24h: z.boolean(),
  acceptsEmergencies: z.boolean(),
  listingStatus: z.enum(LISTING_STATUSES),
  hoursConfirmedAt: z.iso.datetime().nullable(),
  hoursConfirmedBy: z.enum(HOURS_CONFIRMED_BY).nullable(),
  contacts: z.array(
    z.object({
      id: z.uuid(),
      type: z.enum(CONTACT_TYPES),
      value: z.string(),
      label: z.string().nullable(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Branch = z.infer<typeof BranchSchema>;

/** The fields audit_log records for a branch (contacts as one list). */
const AUDITED_FIELDS = [
  'businessId',
  'name',
  'slug',
  'addressLine',
  'provinceCode',
  'cityCode',
  'barangayCode',
  'location',
  'is24h',
  'acceptsEmergencies',
  'listingStatus',
  'contacts',
] as const;

const branchNotFound = () => httpError(404, 'No branch with that id.');

function slugTaken() {
  const message = 'Another branch of this business already uses this slug.';
  return httpError(409, message, [{ pointer: '/slug', message }]);
}

function auditContacts(contacts: readonly { type: string; value: string; label: string | null }[]) {
  return contacts.map(({ type, value, label }) => ({ type, value, label: emptyToNull(label) }));
}

// ── Rules checked against the database ──────────────────────────────────────────────────

interface AreaCodes {
  provinceCode: string;
  cityCode: string;
  barangayCode: string | null;
}

/** The city must be in the province, and the barangay (if any) in the city. */
async function assertAreas(tx: Tx, codes: AreaCodes): Promise<void> {
  const wanted = [codes.provinceCode, codes.cityCode, codes.barangayCode].filter(
    (code) => code !== null,
  );
  const rows = await tx.select().from(psgcArea).where(inArray(psgcArea.code, wanted));
  const area = (code: string | null) => rows.find((row) => row.code === code);

  const errors: FieldError[] = [];
  if (area(codes.provinceCode)?.level !== 'province') {
    errors.push({ pointer: '/provinceCode', message: 'Pick a province.' });
  }
  const city = area(codes.cityCode);
  if (
    city === undefined ||
    (city.level !== 'city' && city.level !== 'municipality') ||
    city.parentCode !== codes.provinceCode
  ) {
    errors.push({ pointer: '/cityCode', message: 'Pick a city or municipality in this province.' });
  }
  if (codes.barangayCode !== null) {
    const barangay = area(codes.barangayCode);
    if (barangay?.level !== 'barangay' || barangay.parentCode !== codes.cityCode) {
      errors.push({ pointer: '/barangayCode', message: 'Pick a barangay in this city.' });
    }
  }
  if (errors.length > 0) throw httpError(400, 'The address areas do not match.', errors);
}

/** 24h / emergency flags are vet-only (ARCHITECTURE §5.3). */
function assertEmergencyFlags(
  type: (typeof BUSINESS_TYPES)[number],
  flags: { is24h: boolean; acceptsEmergencies: boolean },
): void {
  if (BUSINESS_TYPE_RULES[type].emergencyFlags) return;
  const errors: FieldError[] = [];
  const message = 'This type of business cannot be flagged for emergencies.';
  if (flags.is24h) errors.push({ pointer: '/is24h', message });
  if (flags.acceptsEmergencies) errors.push({ pointer: '/acceptsEmergencies', message });
  if (errors.length > 0) throw httpError(400, message, errors);
}

async function replaceContacts(tx: Tx, branchId: string, contacts: readonly ContactInput[]) {
  await tx.delete(branchContact).where(eq(branchContact.branchId, branchId));
  if (contacts.length === 0) return;
  await tx.insert(branchContact).values(
    contacts.map((contact, index) => ({
      branchId,
      type: contact.type,
      value: contact.value,
      label: emptyToNull(contact.label),
      sortOrder: index,
    })),
  );
}

// ── Queries ─────────────────────────────────────────────────────────────────────────────

/** Takes the database or a transaction (writes read their result back inside theirs). */
export async function getBranch(db: Pick<Db, 'select'>, id: string): Promise<Branch> {
  const [row] = await db
    .select({ branch, business })
    .from(branch)
    .innerJoin(business, eq(business.id, branch.businessId))
    .where(eq(branch.id, id));
  if (row === undefined) throw branchNotFound();
  const b = row.branch;

  const codes = [b.provinceCode, b.cityCode, b.barangayCode].filter((code) => code !== null);
  const [areas, contacts] = await Promise.all([
    db
      .select({ code: psgcArea.code, name: psgcArea.name })
      .from(psgcArea)
      .where(inArray(psgcArea.code, codes)),
    db
      .select()
      .from(branchContact)
      .where(eq(branchContact.branchId, id))
      .orderBy(asc(branchContact.sortOrder), asc(branchContact.id)),
  ]);
  const area = (code: string) => {
    const found = areas.find((a) => a.code === code);
    if (found === undefined) throw new Error(`PSGC area ${code} is missing`);
    return found;
  };

  return {
    id: b.id,
    business: {
      id: row.business.id,
      name: row.business.name,
      slug: row.business.slug,
      type: row.business.type,
    },
    name: b.name,
    slug: b.slug,
    addressLine: b.addressLine,
    province: area(b.provinceCode),
    city: area(b.cityCode),
    barangay: b.barangayCode === null ? null : area(b.barangayCode),
    location: b.location,
    is24h: b.is24h,
    acceptsEmergencies: b.acceptsEmergencies,
    listingStatus: b.listingStatus,
    hoursConfirmedAt: b.hoursConfirmedAt?.toISOString() ?? null,
    hoursConfirmedBy: b.hoursConfirmedBy,
    contacts: contacts.map(({ id: contactId, type, value, label }) => ({
      id: contactId,
      type,
      value,
      label,
    })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

// ── Writes (each one records an audit_log entry in the same transaction) ────────────────

export async function createBranch(
  db: Db,
  actorId: string,
  businessId: string,
  input: CreateBranchInput,
): Promise<Branch> {
  const { contacts, ...fields } = input;
  try {
    return await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ type: business.type })
        .from(business)
        .where(eq(business.id, businessId));
      if (owner === undefined) throw businessNotFound();
      await assertAreas(tx, fields);
      assertEmergencyFlags(owner.type, fields);

      const [row] = await tx
        .insert(branch)
        .values({ ...fields, businessId })
        .returning();
      if (row === undefined) throw new Error('insert returned no row');
      await replaceContacts(tx, row.id, contacts);

      await recordAudit(tx, {
        actorId,
        action: 'branch.create',
        entityType: 'branch',
        entityId: row.id,
        diff: diffFields(null, { ...row, contacts: auditContacts(contacts) }, AUDITED_FIELDS),
      });
      return getBranch(tx, row.id);
    });
  } catch (error) {
    if (isUniqueViolation(error, 'branch_businessId_slug_unique')) throw slugTaken();
    throw error;
  }
}

export async function updateBranch(
  db: Db,
  actorId: string,
  id: string,
  patch: UpdateBranchInput,
): Promise<Branch> {
  const { contacts, ...changes } = patch;
  try {
    return await db.transaction(async (tx) => {
      // FOR UPDATE: a concurrent save waits, so each audit entry's "from" is accurate.
      const [before] = await tx.select().from(branch).where(eq(branch.id, id)).for('update');
      if (before === undefined) throw branchNotFound();
      const [owner] = await tx
        .select({ type: business.type })
        .from(business)
        .where(eq(business.id, before.businessId));
      if (owner === undefined) throw new Error('branch without a business');
      const beforeContacts = await tx
        .select()
        .from(branchContact)
        .where(eq(branchContact.branchId, id))
        .orderBy(asc(branchContact.sortOrder), asc(branchContact.id));

      const after = { ...before, ...changes };
      const diff = diffFields(
        { ...before, contacts: auditContacts(beforeContacts) },
        { ...after, contacts: auditContacts(contacts ?? beforeContacts) },
        AUDITED_FIELDS,
      );
      if (Object.keys(diff).length === 0) return getBranch(tx, id);

      if ('provinceCode' in diff || 'cityCode' in diff || 'barangayCode' in diff) {
        await assertAreas(tx, after);
      }
      assertEmergencyFlags(owner.type, after);

      // Always touch updated_at: a contacts-only change still changes the branch's page.
      await tx
        .update(branch)
        .set({ ...changes, updatedAt: new Date() })
        .where(eq(branch.id, id));
      if (contacts !== undefined && 'contacts' in diff) await replaceContacts(tx, id, contacts);

      await recordAudit(tx, {
        actorId,
        action: 'branch.update',
        entityType: 'branch',
        entityId: id,
        diff,
      });
      return getBranch(tx, id);
    });
  } catch (error) {
    if (isUniqueViolation(error, 'branch_businessId_slug_unique')) throw slugTaken();
    throw error;
  }
}
