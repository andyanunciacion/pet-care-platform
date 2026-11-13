import { randomBytes } from 'node:crypto';
import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestSpecies,
  testArea,
  testDatabaseUrl,
} from '@paw/db/testing';
import { toManila } from '@paw/domain';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import type { SearchResponse, SearchResult } from '../../services/search.ts';
import { testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

/** Real reference data (migration 0005/0008), looked up once. */
const ids = { spayNeuter: '', vaccination: '', dog: '', cat: '' };

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  const category = async (code: string) =>
    (await db.select().from(schema.serviceCategory).where(eq(schema.serviceCategory.code, code)))[0]
      ?.id ?? '';
  const species = async (code: string) =>
    (await db.select().from(schema.species).where(eq(schema.species.code, code)))[0]?.id ?? '';
  ids.spayNeuter = await category('spay_neuter');
  ids.vaccination = await category('vaccination');
  ids.dog = await species('dog');
  ids.cat = await species('cat');
});

afterAll(async () => {
  await app.close();
  await database.close();
});

// ── Helpers ─────────────────────────────────────────────────────────────────────────────

interface Point {
  lat: number;
  lng: number;
}

/**
 * A random spot in the Philippines' bounding box, so this test's branches are alone within
 * 1 km: test files share one database and run in parallel (fixtures default to Angeles).
 */
function isolatedPoint(): Point {
  const random = () => randomBytes(4).readUInt32BE() / 0xffffffff;
  return { lat: 5 + random() * 16, lng: 117 + random() * 9 };
}

/** ~111 m per 0.001° of latitude. */
const north = (point: Point, km: number): Point => ({
  lat: point.lat + km / 111.2,
  lng: point.lng,
});

/** A made-up word no real listing contains. */
const uniqueWord = () => `zq${randomBytes(4).toString('hex')}`;

async function listing(
  location: Point,
  options: {
    name?: string;
    business?: Partial<typeof schema.business.$inferInsert>;
    branch?: Partial<typeof schema.branch.$inferInsert>;
  } = {},
) {
  const business = await insertTestBusiness(db, {
    listingStatus: 'published',
    ...(options.name !== undefined && { name: options.name }),
    ...options.business,
  });
  const branch = await insertTestBranch(db, business.id, { location, ...options.branch });
  return { business, branch };
}

async function addService(
  branchId: string,
  values: { categoryId: string; name: string; speciesIds?: string[]; priceMin?: number },
) {
  const [service] = await db
    .insert(schema.branchService)
    .values({
      branchId,
      categoryId: values.categoryId,
      name: values.name,
      priceMin: values.priceMin ?? null,
    })
    .returning();
  if (service === undefined) throw new Error('no service');
  if (values.speciesIds !== undefined && values.speciesIds.length > 0) {
    await db
      .insert(schema.branchServiceSpecies)
      .values(values.speciesIds.map((speciesId) => ({ branchServiceId: service.id, speciesId })));
  }
  return service;
}

const treats = (branchId: string, speciesIds: string[]) =>
  db.insert(schema.branchSpecies).values(speciesIds.map((speciesId) => ({ branchId, speciesId })));

const addPhone = (branchId: string) =>
  db.insert(schema.branchContact).values({ branchId, type: 'phone', value: '+639171234567' });

const get = (params: Record<string, string | number>) =>
  app.inject({
    method: 'GET',
    url: '/v1/search',
    query: Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  });

async function searchNear(
  point: Point,
  params: Record<string, string | number> = {},
): Promise<SearchResponse> {
  const response = await get({ lat: point.lat, lng: point.lng, radiusKm: 1, ...params });
  expect(response.statusCode, response.body).toBe(200);
  return response.json<SearchResponse>();
}

const branchIds = (response: SearchResponse) => response.results.map((result) => result.branch.id);
const servicesOf = (result: SearchResult | undefined) =>
  result?.kind === 'service' ? result.services.map((service) => service.name) : [];

// ── Tests ───────────────────────────────────────────────────────────────────────────────

describe('GET /v1/search: words', () => {
  it('finds spay/neuter services by "kapon", with the category it understood', async () => {
    const point = isolatedPoint();
    const withSpay = await listing(point);
    await addService(withSpay.branch.id, {
      categoryId: ids.spayNeuter,
      name: 'Spay (cat)',
      priceMin: 150_000,
    });
    const without = await listing(point);
    await addService(without.branch.id, { categoryId: ids.vaccination, name: '5-in-1' });

    const response = await searchNear(point, { q: 'kapon' });
    expect(branchIds(response)).toEqual([withSpay.branch.id]);
    const [result] = response.results;
    expect(result?.kind).toBe('service');
    expect(servicesOf(result)).toEqual(['Spay (cat)']);
    expect(response.matchedCategories).toContainEqual({
      code: 'spay_neuter',
      name: 'Spay / neuter',
    });
  });

  it('tolerates typos ("kapn")', async () => {
    const point = isolatedPoint();
    const { branch } = await listing(point);
    await addService(branch.id, { categoryId: ids.spayNeuter, name: 'Neuter' });
    const response = await searchNear(point, { q: 'kapn' });
    expect(branchIds(response)).toEqual([branch.id]);
    expect(response.matchedCategories.map((category) => category.code)).toContain('spay_neuter');
  });

  it('finds words by prefix and stem ("vacc", "vaccines")', async () => {
    const point = isolatedPoint();
    const { branch } = await listing(point);
    await addService(branch.id, { categoryId: ids.vaccination, name: 'Anti-rabies' });
    expect(branchIds(await searchNear(point, { q: 'vacc' }))).toEqual([branch.id]);
    expect(branchIds(await searchNear(point, { q: 'vaccines' }))).toEqual([branch.id]);
  });

  it('matches "kapon pusa" only where the service covers cats', async () => {
    const point = isolatedPoint();
    const forCats = await listing(point);
    await treats(forCats.branch.id, [ids.cat]);
    await addService(forCats.branch.id, {
      categoryId: ids.spayNeuter,
      name: 'Spay',
      speciesIds: [ids.cat],
    });
    // Treats cats, but the spay/neuter service is for dogs only.
    const dogsOnly = await listing(point);
    await treats(dogsOnly.branch.id, [ids.cat, ids.dog]);
    await addService(dogsOnly.branch.id, {
      categoryId: ids.spayNeuter,
      name: 'Castration',
      speciesIds: [ids.dog],
    });
    // The service names no species: the branch's species treated stand in.
    const unspecified = await listing(point);
    await treats(unspecified.branch.id, [ids.cat]);
    await addService(unspecified.branch.id, { categoryId: ids.spayNeuter, name: 'Kapon' });

    const response = await searchNear(point, { q: 'kapon ng pusa' });
    expect(branchIds(response).sort()).toEqual([forCats.branch.id, unspecified.branch.id].sort());
  });

  it('returns a branch result for a name search, and caps matched services at 3', async () => {
    const point = isolatedPoint();
    const word = uniqueWord();
    const named = await listing(point, { name: `${word} Animal Clinic` });
    const result = (await searchNear(point, { q: word })).results[0];
    expect(result?.kind).toBe('branch');
    expect(result?.branch.id).toBe(named.branch.id);

    for (const name of ['5-in-1', '6-in-1', '8-in-1', 'Anti-rabies']) {
      await addService(named.branch.id, { categoryId: ids.vaccination, name });
    }
    const services = await searchNear(point, { q: 'bakuna' });
    expect(servicesOf(services.results[0])).toHaveLength(3);
  });

  it('lets the branch supply words a service lacks ("kapon <city>")', async () => {
    const point = isolatedPoint();
    const word = uniqueWord();
    const { branch } = await listing(point, { name: `${word} Pet Care` });
    await addService(branch.id, { categoryId: ids.spayNeuter, name: 'Spay' });
    const response = await searchNear(point, { q: `kapon ${word}` });
    expect(branchIds(response)).toEqual([branch.id]);
    expect(servicesOf(response.results[0])).toEqual(['Spay']);
  });

  it('treats "vet near me" as a browse of everything nearby', async () => {
    const point = isolatedPoint();
    const a = await listing(point);
    const b = await listing(north(point, 0.3));
    const response = await searchNear(point, { q: 'vet near me' });
    expect(branchIds(response)).toEqual([a.branch.id, b.branch.id]);
    expect(response.results.every((result) => result.kind === 'branch')).toBe(true);
    expect(response.matchedCategories).toEqual([]);
  });
});

describe('GET /v1/search: filters', () => {
  it('filters by species treated', async () => {
    const point = isolatedPoint();
    const rabbit = await insertTestSpecies(db, { name: 'Rabbit (test)' });
    const exotic = await listing(point);
    await treats(exotic.branch.id, [rabbit.id]);
    await listing(point);
    const response = await searchNear(point, { species: rabbit.code });
    expect(branchIds(response)).toEqual([exotic.branch.id]);
  });

  it('filters by category, a group including its categories, and shows the services', async () => {
    const point = isolatedPoint();
    const { branch } = await listing(point);
    await addService(branch.id, { categoryId: ids.spayNeuter, name: 'Neuter' });
    await addService(branch.id, { categoryId: ids.vaccination, name: 'Anti-rabies' });
    await listing(point);

    const response = await searchNear(point, { category: 'surgery' });
    expect(branchIds(response)).toEqual([branch.id]);
    expect(servicesOf(response.results[0])).toEqual(['Neuter']);
  });

  it('keeps only branches open now, never "hours unknown" (UX17)', async () => {
    const point = isolatedPoint();
    const open = await listing(point, { branch: { is24h: true } });
    const closedToday = await listing(point, { branch: { is24h: true } });
    await db.insert(schema.branchHoursException).values({
      branchId: closedToday.branch.id,
      date: toManila(new Date()).date,
      isClosed: true,
    });
    await listing(point); // no hours data

    const response = await searchNear(point, { openNow: 'true' });
    expect(branchIds(response)).toEqual([open.branch.id]);
  });

  it('lists open branches before callable ones in an emergency (UX7, UX19)', async () => {
    const point = isolatedPoint();
    const farOpen = await listing(north(point, 0.6), { branch: { is24h: true } });
    const nearOpen = await listing(north(point, 0.2), { branch: { is24h: true } });
    // Hours unknown, but takes emergency calls.
    const callable = await listing(point, { branch: { acceptsEmergencies: true } });
    await addPhone(callable.branch.id);
    // Takes emergencies, but there's no number to call.
    await listing(point, { branch: { acceptsEmergencies: true } });
    await listing(point); // closed (no hours), no emergencies

    const response = await searchNear(point, { emergency: 'true' });
    expect(branchIds(response)).toEqual([
      nearOpen.branch.id,
      farOpen.branch.id,
      callable.branch.id,
    ]);
    expect(response.results.map((result) => result.emergency)).toEqual([
      'open',
      'open',
      'callable',
    ]);
    expect(response.results[2]?.branch.phone).toBe('+639171234567');
  });

  it('orders by distance and keeps to the radius', async () => {
    const point = isolatedPoint();
    const far = await listing(north(point, 0.8));
    const near = await listing(north(point, 0.1));
    await listing(north(point, 3));
    const response = await searchNear(point);
    expect(branchIds(response)).toEqual([near.branch.id, far.branch.id]);
    expect(response.results[0]?.distanceM).toBeGreaterThan(50);
    expect(response.results[0]?.distanceM).toBeLessThan(150);
  });

  it('searches a city without a location', async () => {
    const word = uniqueWord();
    const inCity = await listing(isolatedPoint(), {
      name: `${word} Clinic`,
      branch: { cityCode: testArea.otherCity, barangayCode: testArea.otherBarangay },
    });
    await listing(isolatedPoint(), { name: `${word} Clinic` }); // in the other test city
    const response = await get({ q: word, cityCode: testArea.otherCity });
    expect(response.statusCode).toBe(200);
    const body = response.json<SearchResponse>();
    expect(branchIds(body)).toEqual([inCity.branch.id]);
    expect(body.results[0]?.distanceM).toBeNull();
  });

  it('never returns hidden or permanently closed listings', async () => {
    const point = isolatedPoint();
    await listing(point, { business: { listingStatus: 'hidden' } });
    await listing(point, { business: { listingStatus: 'permanently_closed' } });
    await listing(point, { branch: { listingStatus: 'hidden' } });
    await listing(point, { branch: { listingStatus: 'permanently_closed' } });
    expect((await searchNear(point)).results).toEqual([]);
  });
});

describe('GET /v1/search: the result card', () => {
  it('has what the card shows', async () => {
    const point = isolatedPoint();
    const { business, branch } = await listing(point, { branch: { is24h: true } });
    await addPhone(branch.id);
    await treats(branch.id, [ids.dog, ids.cat]);
    const [result] = (await searchNear(point)).results;
    expect(result).toMatchObject({
      kind: 'branch',
      business: { id: business.id, slug: business.slug, claimStatus: 'unclaimed' },
      branch: {
        id: branch.id,
        path: `/test-province/test-city/${business.slug}`,
        city: { name: 'Test City' },
        barangay: { name: 'Test Barangay' },
        is24h: true,
        phone: '+639171234567',
        messenger: null,
        species: [
          { code: 'dog', name: 'Dog' },
          { code: 'cat', name: 'Cat' },
        ],
      },
      emergency: null,
    });
  });
});

describe('GET /v1/search: pages', () => {
  it('pages with a cursor, without repeats', async () => {
    const point = isolatedPoint();
    const made = await Promise.all([0.1, 0.2, 0.3].map((km) => listing(north(point, km))));
    const first = await searchNear(point, { limit: 2 });
    expect(first.total).toBe(3);
    expect(first.nextCursor).not.toBeNull();
    const second = await searchNear(point, { limit: 2, cursor: first.nextCursor ?? '' });
    expect(second.nextCursor).toBeNull();
    expect([...branchIds(first), ...branchIds(second)]).toEqual(made.map((row) => row.branch.id));
  });

  it('rejects a bad cursor', async () => {
    const response = await get({ cursor: 'not-a-cursor' });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});

describe('GET /v1/search: invalid requests', () => {
  it.each([
    ['lat without lng', { lat: 15.1 }, '/lng'],
    ['a point and a city', { lat: 15.1, lng: 120.6, cityCode: testArea.city }, '/cityCode'],
    ['a point outside the Philippines', { lat: 35.68, lng: 139.69 }, '/lat'],
    ['a radius without a point', { radiusKm: 5 }, '/radiusKm'],
    ['a radius over the maximum', { lat: 15.1, lng: 120.6, radiusKm: 500 }, '/radiusKm'],
  ])('rejects %s', async (_name, params, pointer) => {
    const response = await get(params);
    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: { pointer: string }[] }>().errors).toContainEqual(
      expect.objectContaining({ pointer }),
    );
  });

  it('rejects unknown species and categories', async () => {
    expect((await get({ species: 'unicorn' })).statusCode).toBe(400);
    expect((await get({ category: 'teleportation' })).statusCode).toBe(400);
  });
});

describe('GET /v1/search: search log', () => {
  const logged = async (word: string) =>
    db.select().from(schema.searchLog).where(eq(schema.searchLog.query, word));

  it('logs the first page, with a coarse area and no coordinates', async () => {
    const point = isolatedPoint();
    const word = uniqueWord();
    await searchNear(point, { q: word.toUpperCase(), openNow: 'true' });
    const rows = await logged(word);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      query: word,
      filters: { openNow: true, radiusKm: 1 },
      area: `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`,
      resultCount: 0,
    });
  });

  it("doesn't log later pages", async () => {
    const point = isolatedPoint();
    const word = uniqueWord();
    await Promise.all([0.1, 0.2].map((km) => listing(north(point, km), { name: `${word} Vets` })));
    const first = await searchNear(point, { q: word, limit: 1 });
    await searchNear(point, { q: word, limit: 1, cursor: first.nextCursor ?? '' });
    expect(await logged(word)).toHaveLength(1);
  });
});

describe('GET /v1/taxonomy', () => {
  it('is public and lists the codes search takes', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/taxonomy' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ species: { code: string }[]; categories: { code: string }[] }>();
    expect(body.species.map((row) => row.code)).toContain('rabbit');
    expect(body.categories.map((row) => row.code)).toContain('surgery');
  });
});
