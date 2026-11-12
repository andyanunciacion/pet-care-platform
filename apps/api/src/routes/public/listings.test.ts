import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestCategory,
  insertTestSpecies,
  testArea,
  testDatabaseUrl,
} from '@paw/db/testing';
import { addDays, toManila } from '@paw/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import type { Listing } from '../../services/listings.ts';
import { testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

// No cookie anywhere: these routes are public.
const get = (slug: string) => app.inject({ method: 'GET', url: `/v1/listings/${slug}` });

async function getListing(slug: string): Promise<Listing> {
  const response = await get(slug);
  expect(response.statusCode).toBe(200);
  return response.json<Listing>();
}

const published = () => insertTestBusiness(db, { listingStatus: 'published' });

describe('GET /v1/listings/:businessSlug', () => {
  it('answers 404 for an unknown slug', async () => {
    const response = await get('no-such-clinic-anywhere');
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('answers 404 for a hidden business', async () => {
    const business = await insertTestBusiness(db);
    await insertTestBranch(db, business.id);
    expect((await get(business.slug)).statusCode).toBe(404);
  });

  it('answers 404 when every branch is hidden', async () => {
    const business = await published();
    await insertTestBranch(db, business.id, { listingStatus: 'hidden' });
    expect((await get(business.slug)).statusCode).toBe(404);
  });

  it('gives a single branch its business URL', async () => {
    const business = await published();
    const branch = await insertTestBranch(db, business.id);

    const listing = await getListing(business.slug);
    expect(listing.business).toMatchObject({
      id: business.id,
      listingStatus: 'published',
      claimStatus: 'unclaimed',
      path: `/test-province/test-city/${business.slug}`,
    });
    expect(listing.branches).toHaveLength(1);
    expect(listing.branches[0]).toMatchObject({
      id: branch.id,
      path: `/test-province/test-city/${business.slug}`,
      city: { name: 'Test City', slug: 'test-city' },
      province: { name: 'Test Province', slug: 'test-province' },
      barangay: { name: 'Test Barangay' },
      location: { lng: 120.5887, lat: 15.145 },
    });
  });

  it('gives each of several branches its own URL in its own city, leaving out hidden ones', async () => {
    const business = await published();
    const first = await insertTestBranch(db, business.id, {
      name: 'Town',
      slug: 'town',
      cityCode: testArea.otherCity,
      barangayCode: testArea.otherBarangay,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const second = await insertTestBranch(db, business.id, {
      name: 'City',
      slug: 'city',
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });
    await insertTestBranch(db, business.id, { slug: 'secret', listingStatus: 'hidden' });

    const listing = await getListing(business.slug);
    // The business sits in its first branch's place.
    expect(listing.business.path).toBe(`/test-province/other-test-town/${business.slug}`);
    expect(listing.branches.map((b) => [b.id, b.path])).toEqual([
      [first.id, `/test-province/other-test-town/${business.slug}/town`],
      [second.id, `/test-province/test-city/${business.slug}/city`],
    ]);
  });

  it('keeps permanently closed listings readable', async () => {
    const business = await insertTestBusiness(db, { listingStatus: 'permanently_closed' });
    await insertTestBranch(db, business.id, { slug: 'open' });
    await insertTestBranch(db, business.id, { slug: 'gone', listingStatus: 'permanently_closed' });

    const listing = await getListing(business.slug);
    expect(listing.business.listingStatus).toBe('permanently_closed');
    expect(listing.branches.map((b) => b.listingStatus)).toEqual([
      'published',
      'permanently_closed',
    ]);
  });

  it('sends hours with exceptions from yesterday on', async () => {
    const business = await published();
    const branch = await insertTestBranch(db, business.id, {
      hoursConfirmedAt: new Date('2026-11-01T02:00:00Z'),
      hoursConfirmedBy: 'paw_ops',
    });
    await db.insert(schema.branchHours).values([
      { branchId: branch.id, dayOfWeek: 1, opensAt: '13:00', closesAt: '17:00' },
      { branchId: branch.id, dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
      { branchId: branch.id, dayOfWeek: 5, opensAt: '20:00', closesAt: '02:00' },
    ]);
    const today = toManila(new Date()).date;
    await db.insert(schema.branchHoursException).values([
      { branchId: branch.id, date: addDays(today, -2), isClosed: true },
      { branchId: branch.id, date: addDays(today, 3), isClosed: true, note: 'Holiday' },
      {
        branchId: branch.id,
        date: addDays(today, -1),
        isClosed: false,
        intervals: [{ opensAt: '20:00', closesAt: '03:00' }],
      },
    ]);

    const [listed] = (await getListing(business.slug)).branches;
    expect(listed).toMatchObject({
      is24h: false,
      hoursConfirmedAt: '2026-11-01T02:00:00.000Z',
      hoursConfirmedBy: 'paw_ops',
      weekly: [
        { dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
        { dayOfWeek: 1, opensAt: '13:00', closesAt: '17:00' },
        { dayOfWeek: 5, opensAt: '20:00', closesAt: '02:00' },
      ],
      exceptions: [
        {
          date: addDays(today, -1),
          isClosed: false,
          intervals: [{ opensAt: '20:00', closesAt: '03:00' }],
          note: null,
        },
        { date: addDays(today, 3), isClosed: true, intervals: [], note: 'Holiday' },
      ],
    });
  });

  it('sends contacts, species and services in display order, species by name', async () => {
    const business = await published();
    const branch = await insertTestBranch(db, business.id);
    await db.insert(schema.branchContact).values([
      { branchId: branch.id, type: 'viber', value: '+639171234567', sortOrder: 1 },
      { branchId: branch.id, type: 'phone', value: '+639181234567', label: 'Smart', sortOrder: 0 },
    ]);
    const dog = await insertTestSpecies(db, { name: 'Listing dog', sortOrder: 1 });
    const cat = await insertTestSpecies(db, { name: 'Listing cat', sortOrder: 2 });
    await db.insert(schema.branchSpecies).values([
      { branchId: branch.id, speciesId: cat.id },
      { branchId: branch.id, speciesId: dog.id },
    ]);
    const group = await insertTestCategory(db, { name: 'Listing surgery', sortOrder: 1 });
    const spay = await insertTestCategory(db, { name: 'Listing spay', parentId: group.id });
    const [service] = await db
      .insert(schema.branchService)
      .values({
        branchId: branch.id,
        categoryId: spay.id,
        name: 'Kapon (cat)',
        priceMin: 150000,
        priceMax: 250000,
        priceUnit: 'per_visit',
      })
      .returning();
    if (service === undefined) throw new Error('no service');
    await db.insert(schema.branchServiceSpecies).values([
      { branchServiceId: service.id, speciesId: cat.id },
      { branchServiceId: service.id, speciesId: dog.id },
    ]);

    const [listed] = (await getListing(business.slug)).branches;
    expect(listed?.contacts).toEqual([
      { type: 'phone', value: '+639181234567', label: 'Smart' },
      { type: 'viber', value: '+639171234567', label: null },
    ]);
    expect(listed?.species).toEqual([
      { code: dog.code, name: 'Listing dog' },
      { code: cat.code, name: 'Listing cat' },
    ]);
    expect(listed?.services).toEqual([
      {
        id: service.id,
        category: { name: 'Listing spay', groupName: 'Listing surgery' },
        name: 'Kapon (cat)',
        description: null,
        priceMin: 150000,
        priceMax: 250000,
        priceUnit: 'per_visit',
        priceNote: null,
        species: ['Listing dog', 'Listing cat'],
      },
    ]);
  });
});
