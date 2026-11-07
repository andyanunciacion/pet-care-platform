import { createDatabase } from '@paw/db';
import {
  insertTestAreas,
  insertTestBusiness,
  insertTestUser,
  testArea,
  testDatabaseUrl,
} from '@paw/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
let admin: Awaited<ReturnType<typeof insertTestUser>>;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  admin = await insertTestUser(db, { platformRole: 'super_admin' });
  cookie = await sessionCookie(app, admin.id);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } });
const send = (method: 'POST' | 'PATCH', url: string, payload: object) =>
  app.inject({ method, url, headers: { cookie }, payload });

describe('GET /v1/admin/psgc-areas', () => {
  it('lists provinces, including Pampanga', async () => {
    const response = await get('/v1/admin/psgc-areas');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toContainEqual({
      code: '0305400000',
      name: 'Pampanga',
      level: 'province',
    });
  });

  it("lists a province's cities and municipalities, by name", async () => {
    const response = await get(`/v1/admin/psgc-areas?parentCode=${testArea.province}`);
    expect(response.json()).toEqual([
      { code: testArea.otherCity, name: 'Other Test Town', level: 'municipality' },
      { code: testArea.city, name: 'Test City', level: 'city' },
    ]);
  });

  it("lists a city's barangays", async () => {
    const response = await get(`/v1/admin/psgc-areas?parentCode=${testArea.city}`);
    expect(response.json()).toEqual([
      { code: testArea.barangay, name: 'Test Barangay', level: 'barangay' },
    ]);
  });

  it('400 for a malformed code', async () => {
    expect((await get('/v1/admin/psgc-areas?parentCode=abc')).statusCode).toBe(400);
  });
});

describe('GET /v1/admin/taxonomy', () => {
  interface Item {
    id: string;
    code: string;
    name: string;
  }
  interface Taxonomy {
    species: Item[];
    categories: (Item & { children: Item[] })[];
  }

  it('lists the species and the category groups with their subcategories', async () => {
    const response = await get('/v1/admin/taxonomy');
    expect(response.statusCode).toBe(200);
    const body = response.json<Taxonomy>();

    // The real reference data (migration 0005), skipping rows other test files add.
    const real = <T extends Item>(items: T[]) =>
      items.filter((item) => !/^(species|category)_/.test(item.code));
    expect(
      real(body.species)
        .map((s) => s.code)
        .slice(0, 2),
    ).toEqual(['dog', 'cat']);
    const surgery = body.categories.find((c) => c.code === 'surgery');
    expect(real(surgery?.children ?? []).map((c) => c.code)).toEqual([
      'spay_neuter',
      'general_surgery',
      'dental',
    ]);
    // Subcategories only appear under their group.
    const topLevel = body.categories.map((c) => c.code);
    expect(topLevel).not.toContain('spay_neuter');
  });
});

describe('GET /v1/admin/audit-log', () => {
  interface Page {
    items: { action: string; entityId: string; actor: { email: string } | null }[];
    nextBefore: string | null;
  }

  it("shows a business's trail (business and branches), newest first, with the actor", async () => {
    const business = await insertTestBusiness(db);
    await send('PATCH', `/v1/admin/businesses/${business.id}`, { name: 'Renamed Clinic' });
    const branch = await send('POST', `/v1/admin/businesses/${business.id}/branches`, {
      name: 'Main',
      slug: 'main',
      addressLine: '1 Test Street',
      provinceCode: testArea.province,
      cityCode: testArea.city,
      location: { lng: 120.5887, lat: 15.145 },
    });
    const branchId = branch.json<{ id: string }>().id;

    const response = await get(`/v1/admin/audit-log?businessId=${business.id}`);
    expect(response.statusCode).toBe(200);
    const page = response.json<Page>();
    expect(page.items.map((item) => [item.action, item.entityId])).toEqual([
      ['branch.create', branchId],
      ['business.update', business.id],
    ]);
    expect(page.items[0]?.actor?.email).toBe(admin.email);
    expect(page.nextBefore).toBeNull();
  });

  it('pages with the before cursor', async () => {
    const business = await insertTestBusiness(db);
    for (const name of ['One', 'Two', 'Three']) {
      await send('PATCH', `/v1/admin/businesses/${business.id}`, { name });
    }
    const url = `/v1/admin/audit-log?entityType=business&entityId=${business.id}&limit=2`;

    const first = (await get(url)).json<Page>();
    expect(first.items).toHaveLength(2);
    expect(first.nextBefore).not.toBeNull();

    const second = (await get(`${url}&before=${String(first.nextBefore)}`)).json<Page>();
    expect(second.items).toHaveLength(1);
    expect(second.nextBefore).toBeNull();
  });
});
