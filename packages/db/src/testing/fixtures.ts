import { randomBytes } from 'node:crypto';
import type { Db } from '../client.ts';
import { branch, business, psgcArea, serviceCategory, species } from '../schema/index.ts';

// Fake PSGC codes for tests ("99" is not a real region), so test rows never collide with
// the real reference data.
export const testArea = {
  province: '9900000000',
  city: '9900100000',
  barangay: '9900100001',
} as const;

/** Inserts the fake province → city → barangay (safe to call from every test file). */
export async function insertTestAreas(db: Db): Promise<void> {
  await db
    .insert(psgcArea)
    .values([
      { code: testArea.province, name: 'Test Province', level: 'province' },
      { code: testArea.city, name: 'Test City', level: 'city', parentCode: testArea.province },
      {
        code: testArea.barangay,
        name: 'Test Barangay',
        level: 'barangay',
        parentCode: testArea.city,
      },
    ])
    .onConflictDoNothing();
}

/** A slug that's unique across test files running in parallel against the same database. */
export function uniqueSlug(prefix = 'test'): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

export async function insertTestBusiness(
  db: Db,
  values: Partial<typeof business.$inferInsert> = {},
): Promise<typeof business.$inferSelect> {
  const [row] = await db
    .insert(business)
    .values({ name: 'Test Vet Clinic', slug: uniqueSlug(), type: 'vet_clinic', ...values })
    .returning();
  if (row === undefined) throw new Error('insert returned no row');
  return row;
}

/** Inserts a branch in the fake test city (call insertTestAreas first). */
export async function insertTestBranch(
  db: Db,
  businessId: string,
  values: Partial<typeof branch.$inferInsert> = {},
): Promise<typeof branch.$inferSelect> {
  const [row] = await db
    .insert(branch)
    .values({
      businessId,
      name: 'Main',
      slug: uniqueSlug('branch'),
      addressLine: '1 Test Street',
      provinceCode: testArea.province,
      cityCode: testArea.city,
      barangayCode: testArea.barangay,
      // Angeles City
      location: { lng: 120.5887, lat: 15.145 },
      ...values,
    })
    .returning();
  if (row === undefined) throw new Error('insert returned no row');
  return row;
}

/** A taxonomy code that's unique across parallel test files, e.g. "test_1a2b3c4d". */
export function uniqueCode(prefix = 'test'): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

export async function insertTestSpecies(
  db: Db,
  values: Partial<typeof species.$inferInsert> = {},
): Promise<typeof species.$inferSelect> {
  const [row] = await db
    .insert(species)
    .values({ code: uniqueCode('species'), name: 'Test species', ...values })
    .returning();
  if (row === undefined) throw new Error('insert returned no row');
  return row;
}

export async function insertTestCategory(
  db: Db,
  values: Partial<typeof serviceCategory.$inferInsert> = {},
): Promise<typeof serviceCategory.$inferSelect> {
  const [row] = await db
    .insert(serviceCategory)
    .values({ code: uniqueCode('category'), name: 'Test category', ...values })
    .returning();
  if (row === undefined) throw new Error('insert returned no row');
  return row;
}

/**
 * Runs a query that should break a database rule, and returns the name of the constraint
 * it violated (undefined if it succeeded). Other errors are rethrown.
 */
export async function violatedConstraint(query: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await query;
    return undefined;
  } catch (error) {
    // Drizzle wraps the driver's error; the Postgres details are on `cause`.
    const pgError: unknown =
      error instanceof Error && error.cause !== undefined ? error.cause : error;
    if (typeof pgError === 'object' && pgError !== null && 'constraint' in pgError) {
      return String(pgError.constraint);
    }
    throw error;
  }
}
