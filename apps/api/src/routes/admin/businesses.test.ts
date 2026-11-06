import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestUser,
  testArea,
  testDatabaseUrl,
  uniqueSlug,
} from '@paw/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
let adminId: string;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
  adminId = admin.id;
  cookie = await sessionCookie(app, admin.id);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined && { payload }) });

const auditEntries = (entityId: string) =>
  db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, entityId));

describe('POST /v1/admin/businesses', () => {
  it('creates a hidden, unclaimed business and records it in the audit log', async () => {
    const slug = uniqueSlug('create');
    const response = await call('POST', '/v1/admin/businesses', {
      name: '  Create Test Clinic ',
      slug,
      type: 'vet_clinic',
      dataSource: 'Clinic visit',
      description: '',
    });

    expect(response.statusCode).toBe(201);
    const created = response.json<{ id: string }>();
    expect(created).toMatchObject({
      name: 'Create Test Clinic',
      slug,
      type: 'vet_clinic',
      claimStatus: 'unclaimed',
      listingStatus: 'hidden',
      dataSource: 'Clinic visit',
      description: null,
    });

    const entries = await auditEntries(created.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorId: adminId,
      action: 'business.create',
      entityType: 'business',
      diff: {
        name: { from: null, to: 'Create Test Clinic' },
        slug: { from: null, to: slug },
        dataSource: { from: null, to: 'Clinic visit' },
        listingStatus: { from: null, to: 'hidden' },
      },
    });
    // Empty fields aren't listed on create.
    expect(entries[0]?.diff).not.toHaveProperty('description');
  });

  it('409 with a field error when the slug is taken', async () => {
    const existing = await insertTestBusiness(db);
    const response = await call('POST', '/v1/admin/businesses', {
      name: 'Copycat',
      slug: existing.slug,
      type: 'vet_clinic',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      status: 409,
      errors: [{ location: 'body', pointer: '/slug' }],
    });
  });

  it('400 for a slug that is not URL-safe', async () => {
    const response = await call('POST', '/v1/admin/businesses', {
      name: 'Bad Slug',
      slug: 'Bad Slug!',
      type: 'vet_clinic',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/slug' }] });
  });
});

describe('PATCH /v1/admin/businesses/:id', () => {
  it('changes only the fields sent and records a from → to diff', async () => {
    const business = await insertTestBusiness(db, { name: 'Before Name' });
    const response = await call('PATCH', `/v1/admin/businesses/${business.id}`, {
      name: 'After Name',
      listingStatus: 'published',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'After Name',
      slug: business.slug,
      listingStatus: 'published',
    });

    const entries = await auditEntries(business.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'business.update',
      diff: {
        name: { from: 'Before Name', to: 'After Name' },
        listingStatus: { from: 'hidden', to: 'published' },
      },
    });
  });

  it('records nothing when nothing changed', async () => {
    const business = await insertTestBusiness(db, { name: 'Same Name' });
    const response = await call('PATCH', `/v1/admin/businesses/${business.id}`, {
      name: 'Same Name',
    });

    expect(response.statusCode).toBe(200);
    expect(await auditEntries(business.id)).toHaveLength(0);
  });

  it('409 when renaming to a taken slug, and nothing is recorded', async () => {
    const [first, second] = [await insertTestBusiness(db), await insertTestBusiness(db)];
    const response = await call('PATCH', `/v1/admin/businesses/${second.id}`, {
      slug: first.slug,
    });

    expect(response.statusCode).toBe(409);
    expect(await auditEntries(second.id)).toHaveLength(0);
  });

  it('404 for an unknown business', async () => {
    const response = await call('PATCH', `/v1/admin/businesses/${crypto.randomUUID()}`, {
      name: 'Nobody',
    });
    expect(response.statusCode).toBe(404);
  });

  it('ignores claim status (owned by the claim flow)', async () => {
    const business = await insertTestBusiness(db);
    await call('PATCH', `/v1/admin/businesses/${business.id}`, { claimStatus: 'verified' });

    const [row] = await db
      .select({ claimStatus: schema.business.claimStatus })
      .from(schema.business)
      .where(eq(schema.business.id, business.id));
    expect(row?.claimStatus).toBe('unclaimed');
  });
});

describe('GET /v1/admin/businesses/:id', () => {
  it('returns the business with its branches and their cities', async () => {
    const business = await insertTestBusiness(db);
    const branch = await insertTestBranch(db, business.id, { name: 'Balibago' });

    const response = await call('GET', `/v1/admin/businesses/${business.id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: business.id,
      branches: [
        { id: branch.id, name: 'Balibago', city: { code: testArea.city, name: 'Test City' } },
      ],
    });
  });

  it('404 for an unknown business', async () => {
    expect((await call('GET', `/v1/admin/businesses/${crypto.randomUUID()}`)).statusCode).toBe(404);
  });
});

describe('GET /v1/admin/businesses', () => {
  // A word no other test uses, so parallel test files don't change the counts.
  const marker = uniqueSlug('zq');

  beforeAll(async () => {
    const a = await insertTestBusiness(db, { name: `Alpha ${marker}`, listingStatus: 'published' });
    await insertTestBranch(db, a.id);
    await insertTestBranch(db, a.id, { cityCode: testArea.otherCity, barangayCode: null });
    const b = await insertTestBusiness(db, { name: `Bravo Clinic` });
    await insertTestBranch(db, b.id, { name: `Bravo ${marker} branch` });
    await insertTestBusiness(db, { name: `Charlie ${marker}`, claimStatus: 'verified' });
  });

  type List = {
    items: { name: string; branchCount: number; cities: { name: string }[] }[];
    total: number;
  };
  const list = async (query: string) => {
    const response = await call('GET', `/v1/admin/businesses?q=${marker}&${query}`);
    expect(response.statusCode).toBe(200);
    return response.json<List>();
  };

  it('searches business and branch names, sorted by name', async () => {
    const result = await list('');
    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.name)).toEqual([
      `Alpha ${marker}`,
      'Bravo Clinic',
      `Charlie ${marker}`,
    ]);
    expect(result.items[0]).toMatchObject({
      branchCount: 2,
      cities: [{ name: 'Other Test Town' }, { name: 'Test City' }],
    });
  });

  it('filters by city, claim status and listing status', async () => {
    expect((await list(`cityCode=${testArea.otherCity}`)).items.map((i) => i.name)).toEqual([
      `Alpha ${marker}`,
    ]);
    expect((await list('claimStatus=verified')).items.map((i) => i.name)).toEqual([
      `Charlie ${marker}`,
    ]);
    expect((await list('listingStatus=published')).items.map((i) => i.name)).toEqual([
      `Alpha ${marker}`,
    ]);
  });

  it('pages', async () => {
    const page2 = await list('pageSize=2&page=2');
    expect(page2.total).toBe(3);
    expect(page2.items.map((item) => item.name)).toEqual([`Charlie ${marker}`]);
  });

  it('treats LIKE wildcards in the search as plain text', async () => {
    // Unescaped, "%" + marker would match all three.
    const response = await call('GET', `/v1/admin/businesses?q=%25${marker}`);
    expect(response.json<List>().total).toBe(0);
  });
});
