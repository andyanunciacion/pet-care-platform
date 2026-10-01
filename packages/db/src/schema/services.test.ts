import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../client.ts';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestCategory,
  insertTestSpecies,
  testDatabaseUrl,
  violatedConstraint,
} from '../testing/index.ts';
import { branch } from './branch.ts';
import { branchService, branchServiceSpecies, branchSpecies } from './services.ts';
import { serviceCategory, species } from './taxonomy.ts';

const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  await insertTestAreas(db);
});

afterAll(async () => {
  await database.close();
});

async function newBranch() {
  const { id: businessId } = await insertTestBusiness(db);
  return insertTestBranch(db, businessId);
}

/** Values for a service at a new branch, in a new category; spread in overrides. */
async function serviceValues() {
  const [{ id: branchId }, { id: categoryId }] = await Promise.all([
    newBranch(),
    insertTestCategory(db),
  ]);
  return { branchId, categoryId, name: 'Consultation' };
}

describe('species and service_category', () => {
  it('have unique codes in snake_case', async () => {
    const { code } = await insertTestSpecies(db);
    expect(await violatedConstraint(insertTestSpecies(db, { code }))).toBe('species_code_unique');
    expect(await violatedConstraint(insertTestSpecies(db, { code: 'Small Mammal' }))).toBe(
      'species_code_format',
    );
    expect(await violatedConstraint(insertTestCategory(db, { code: 'spay-neuter' }))).toBe(
      'service_category_code_format',
    );
  });

  it('nest categories, with synonyms for search', async () => {
    const surgery = await insertTestCategory(db, { name: 'Surgery' });
    // Made-up synonyms: test files share one database, so real ones ("kapon") would show up
    // in the reference-data tests' searches.
    const synonyms = ['test synonym', 'another test synonym'];
    const child = await insertTestCategory(db, {
      name: 'Spay / neuter',
      parentId: surgery.id,
      synonyms,
    });
    expect(child).toMatchObject({ parentId: surgery.id, synonyms });
    expect((await insertTestCategory(db)).synonyms).toEqual([]);
  });

  it("can't make a category its own parent", async () => {
    const category = await insertTestCategory(db);
    const query = db
      .update(serviceCategory)
      .set({ parentId: category.id })
      .where(eq(serviceCategory.id, category.id));
    expect(await violatedConstraint(query)).toBe('service_category_not_own_parent');
  });

  it("can't delete a category that has subcategories or services", async () => {
    const parent = await insertTestCategory(db);
    await insertTestCategory(db, { parentId: parent.id });
    const deleteParent = db.delete(serviceCategory).where(eq(serviceCategory.id, parent.id));
    expect(await violatedConstraint(deleteParent)).toBe(
      'service_category_parent_id_service_category_id_fk',
    );

    const values = await serviceValues();
    await db.insert(branchService).values(values);
    const deleteUsed = db.delete(serviceCategory).where(eq(serviceCategory.id, values.categoryId));
    expect(await violatedConstraint(deleteUsed)).toBe(
      'branch_service_category_id_service_category_id_fk',
    );
  });
});

describe('branch_species', () => {
  it('lists each species once per branch', async () => {
    const [{ id: branchId }, dog, cat] = await Promise.all([
      newBranch(),
      insertTestSpecies(db, { name: 'Dog' }),
      insertTestSpecies(db, { name: 'Cat' }),
    ]);
    await db.insert(branchSpecies).values([
      { branchId, speciesId: dog.id },
      { branchId, speciesId: cat.id },
    ]);
    const duplicate = db.insert(branchSpecies).values({ branchId, speciesId: dog.id });
    expect(await violatedConstraint(duplicate)).toBe('branch_species_branch_id_species_id_pk');
  });

  it('keeps a species in use from being deleted, and goes away with the branch', async () => {
    const [{ id: branchId }, rabbit] = await Promise.all([newBranch(), insertTestSpecies(db)]);
    await db.insert(branchSpecies).values({ branchId, speciesId: rabbit.id });

    const deleteSpecies = db.delete(species).where(eq(species.id, rabbit.id));
    expect(await violatedConstraint(deleteSpecies)).toBe('branch_species_species_id_species_id_fk');

    await db.delete(branch).where(eq(branch.id, branchId));
    expect(
      await db.select().from(branchSpecies).where(eq(branchSpecies.branchId, branchId)),
    ).toEqual([]);
  });
});

describe('branch_service', () => {
  it('stores a price range, a minimum only, or no price', async () => {
    const values = await serviceValues();
    const rows = await db
      .insert(branchService)
      .values([
        { ...values, priceMin: 50_000, priceMax: 80_000 }, // ₱500–₱800
        { ...values, priceMin: 50_000 }, // From ₱500
        { ...values }, // Call for price
        { ...values, priceMin: 80_000, priceMax: 80_000, priceUnit: 'per_night' }, // ₱800/night
      ])
      .returning();
    expect(rows.map((row) => [row.priceMin, row.priceMax, row.priceUnit])).toEqual([
      [50_000, 80_000, 'per_visit'],
      [50_000, null, 'per_visit'],
      [null, null, 'per_visit'],
      [80_000, 80_000, 'per_night'],
    ]);
  });

  it('rejects negative prices, a maximum below the minimum, or a maximum alone', async () => {
    const values = await serviceValues();
    const cases = [
      [{ priceMin: -100 }, 'branch_service_price_min_positive'],
      [{ priceMin: 80_000, priceMax: 50_000 }, 'branch_service_price_range'],
      [{ priceMax: 80_000 }, 'branch_service_price_range'],
    ] as const;
    for (const [prices, constraint] of cases) {
      const query = db.insert(branchService).values({ ...values, ...prices });
      expect(await violatedConstraint(query)).toBe(constraint);
    }
  });

  it('links the species a service covers, removed with the service', async () => {
    const [values, dog] = await Promise.all([serviceValues(), insertTestSpecies(db)]);
    const [service] = await db.insert(branchService).values(values).returning();
    if (service === undefined) throw new Error('insert returned no row');
    await db
      .insert(branchServiceSpecies)
      .values({ branchServiceId: service.id, speciesId: dog.id });

    await db.delete(branchService).where(eq(branchService.id, service.id));
    const links = await db
      .select()
      .from(branchServiceSpecies)
      .where(eq(branchServiceSpecies.branchServiceId, service.id));
    expect(links).toEqual([]);
  });
});
