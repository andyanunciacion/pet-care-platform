import { randomUUID } from 'node:crypto';
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
import { createMemoryStorage } from '../../storage.ts';
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

describe('GET /v1/listings/:businessSlug: images and products', () => {
  let withStorage: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    withStorage = await buildApp({ env: testEnv(), storage: createMemoryStorage() });
  });

  afterAll(async () => {
    await withStorage.close();
  });

  const image = (key: string, alt: string) => ({
    storageKey: `listing-test/${key}-${randomUUID()}.webp`,
    alt,
    width: 1600,
    height: 1200,
  });

  async function product(businessId: string, name: string, category: string | null) {
    const [row] = await db
      .insert(schema.product)
      .values({ businessId, name, category, price: category === null ? null : 125000 })
      .returning();
    if (row === undefined) throw new Error('no product');
    return row;
  }

  /** A business with a logo, two photos on its branch and two products (one with an image). */
  async function businessWithImages() {
    const business = await published();
    const branch = await insertTestBranch(db, business.id);
    const food = await product(business.id, 'Dog food 2 kg', 'Food');
    const collar = await product(business.id, 'Flea collar', null);
    const logo = image('logo', 'Clinic logo');
    const second = image('second', 'Waiting area');
    const first = image('first', 'Front of the clinic');
    const foodImage = image('food', 'A bag of dog food');
    await db.insert(schema.media).values([
      { kind: 'logo', businessId: business.id, ...logo },
      { kind: 'photo', branchId: branch.id, sortOrder: 1, ...second },
      { kind: 'photo', branchId: branch.id, sortOrder: 0, ...first },
      { kind: 'photo', productId: food.id, ...foodImage },
    ]);
    return { business, food, collar, logo, first, second, foodImage };
  }

  const publicImage = ({ storageKey, alt }: { storageKey: string; alt: string }) => ({
    url: `https://photos.test/${storageKey}`,
    alt,
    width: 1600,
    height: 1200,
  });

  it('sends the logo, branch photos in order and products with their images', async () => {
    const { business, food, collar, logo, first, second, foodImage } = await businessWithImages();

    const response = await withStorage.inject({ url: `/v1/listings/${business.slug}` });
    expect(response.statusCode).toBe(200);
    const listing = response.json<Listing>();

    expect(listing.business.logo).toEqual(publicImage(logo));
    expect(listing.branches[0]?.photos).toEqual([publicImage(first), publicImage(second)]);
    // By category, uncategorized last.
    expect(listing.business.products).toEqual([
      {
        id: food.id,
        name: 'Dog food 2 kg',
        category: 'Food',
        price: 125000,
        availability: 'available',
        image: publicImage(foodImage),
      },
      {
        id: collar.id,
        name: 'Flea collar',
        category: null,
        price: null,
        availability: 'available',
        image: null,
      },
    ]);
  });

  it("never sends another business's images", async () => {
    await businessWithImages();
    const business = await published();
    await insertTestBranch(db, business.id);

    const listing = (
      await withStorage.inject({ url: `/v1/listings/${business.slug}` })
    ).json<Listing>();
    expect(listing.business.logo).toBeNull();
    expect(listing.business.products).toEqual([]);
    expect(listing.branches[0]?.photos).toEqual([]);
  });

  it('sends no images when photo storage is not set up, but still the products', async () => {
    const { business } = await businessWithImages();

    const listing = await getListing(business.slug);
    expect(listing.business.logo).toBeNull();
    expect(listing.branches[0]?.photos).toEqual([]);
    expect(listing.business.products.map((p) => [p.name, p.image])).toEqual([
      ['Dog food 2 kg', null],
      ['Flea collar', null],
    ]);
  });
});
