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
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
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

// Angeles City
const pin = { lng: 120.5887, lat: 15.145 };

const validBranch = () => ({
  name: 'Balibago',
  slug: uniqueSlug('branch'),
  addressLine: '123 Fields Avenue',
  provinceCode: testArea.province,
  cityCode: testArea.city,
  barangayCode: testArea.barangay,
  location: pin,
  acceptsEmergencies: true,
  contacts: [
    { type: 'phone', value: '0917 123 4567', label: 'Globe' },
    { type: 'phone', value: '(045) 888 1234', label: '' },
    { type: 'messenger', value: 'https://m.me/testclinic' },
  ],
});

interface BranchBody {
  id: string;
  contacts: { type: string; value: string; label: string | null }[];
}

describe('POST /v1/admin/businesses/:id/branches', () => {
  it('creates a branch with normalized contacts and records it', async () => {
    const business = await insertTestBusiness(db);
    const input = validBranch();
    const response = await call('POST', `/v1/admin/businesses/${business.id}/branches`, input);

    expect(response.statusCode).toBe(201);
    const created = response.json<BranchBody>();
    expect(created).toMatchObject({
      business: { id: business.id, type: 'vet_clinic' },
      name: 'Balibago',
      province: { code: testArea.province, name: 'Test Province' },
      city: { code: testArea.city, name: 'Test City' },
      barangay: { code: testArea.barangay, name: 'Test Barangay' },
      location: pin,
      is24h: false,
      acceptsEmergencies: true,
      listingStatus: 'published',
      hoursConfirmedAt: null,
    });
    expect(created.contacts.map(({ type, value, label }) => ({ type, value, label }))).toEqual([
      { type: 'phone', value: '+639171234567', label: 'Globe' },
      { type: 'phone', value: '+63458881234', label: null },
      { type: 'messenger', value: 'https://m.me/testclinic', label: null },
    ]);

    const entries = await auditEntries(created.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'branch.create',
      entityType: 'branch',
      diff: {
        businessId: { from: null, to: business.id },
        location: { from: null, to: pin },
        contacts: {
          from: null,
          to: [
            { type: 'phone', value: '+639171234567', label: 'Globe' },
            { type: 'phone', value: '+63458881234', label: null },
            { type: 'messenger', value: 'https://m.me/testclinic', label: null },
          ],
        },
      },
    });
  });

  it('400 with field errors when the areas do not nest', async () => {
    const business = await insertTestBusiness(db);
    const response = await call('POST', `/v1/admin/businesses/${business.id}/branches`, {
      ...validBranch(),
      // A barangay of another town.
      barangayCode: testArea.otherBarangay,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/barangayCode' }] });
  });

  it('400 when the province is not a province', async () => {
    const business = await insertTestBusiness(db);
    const response = await call('POST', `/v1/admin/businesses/${business.id}/branches`, {
      ...validBranch(),
      provinceCode: testArea.city,
    });

    expect(response.statusCode).toBe(400);
    const pointers = response
      .json<{ errors: { pointer: string }[] }>()
      .errors.map((e) => e.pointer);
    expect(pointers).toEqual(['/provinceCode', '/cityCode']);
  });

  it('400 for a phone number that is not a real number', async () => {
    const business = await insertTestBusiness(db);
    const response = await call('POST', `/v1/admin/businesses/${business.id}/branches`, {
      ...validBranch(),
      contacts: [{ type: 'phone', value: '0917 123' }],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/contacts/0/value' }] });
  });

  it('400 for a pin outside the Philippines (e.g. lat and lng swapped)', async () => {
    const business = await insertTestBusiness(db);
    const response = await call('POST', `/v1/admin/businesses/${business.id}/branches`, {
      ...validBranch(),
      location: { lng: pin.lat, lat: pin.lng },
    });

    expect(response.statusCode).toBe(400);
  });

  it('409 when the business already has a branch with that slug', async () => {
    const business = await insertTestBusiness(db);
    const existing = await insertTestBranch(db, business.id);
    const response = await call('POST', `/v1/admin/businesses/${business.id}/branches`, {
      ...validBranch(),
      slug: existing.slug,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/slug' }] });
  });

  it('allows the same branch slug under different businesses', async () => {
    const [first, second] = [await insertTestBusiness(db), await insertTestBusiness(db)];
    const input = validBranch();
    const url = (id: string) => `/v1/admin/businesses/${id}/branches`;

    expect((await call('POST', url(first.id), input)).statusCode).toBe(201);
    expect((await call('POST', url(second.id), input)).statusCode).toBe(201);
  });

  it('404 for an unknown business', async () => {
    const response = await call(
      'POST',
      `/v1/admin/businesses/${crypto.randomUUID()}/branches`,
      validBranch(),
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /v1/admin/branches/:id', () => {
  const createBranch = async () => {
    const business = await insertTestBusiness(db);
    const response = await call(
      'POST',
      `/v1/admin/businesses/${business.id}/branches`,
      validBranch(),
    );
    return response.json<BranchBody>();
  };

  it('replaces the contact list and records from → to', async () => {
    const branch = await createBranch();
    const response = await call('PATCH', `/v1/admin/branches/${branch.id}`, {
      contacts: [{ type: 'viber', value: '+63 917 765 4321', label: null }],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<BranchBody>().contacts).toMatchObject([
      { type: 'viber', value: '+639177654321', label: null },
    ]);

    const updates = (await auditEntries(branch.id)).filter((e) => e.action === 'branch.update');
    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0]?.diff ?? {})).toEqual(['contacts']);
    expect(updates[0]?.diff?.contacts?.to).toEqual([
      { type: 'viber', value: '+639177654321', label: null },
    ]);
  });

  it('moves a branch to another town and pin', async () => {
    const branch = await createBranch();
    const newPin = { lng: 120.5525, lat: 15.2213 };
    const response = await call('PATCH', `/v1/admin/branches/${branch.id}`, {
      cityCode: testArea.otherCity,
      barangayCode: testArea.otherBarangay,
      location: newPin,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      city: { code: testArea.otherCity },
      barangay: { code: testArea.otherBarangay },
      location: newPin,
    });
    const update = (await auditEntries(branch.id)).find((e) => e.action === 'branch.update');
    expect(update?.diff).toEqual({
      cityCode: { from: testArea.city, to: testArea.otherCity },
      barangayCode: { from: testArea.barangay, to: testArea.otherBarangay },
      location: { from: pin, to: newPin },
    });
  });

  it('400 when the new city leaves the old barangay behind', async () => {
    const branch = await createBranch();
    const response = await call('PATCH', `/v1/admin/branches/${branch.id}`, {
      cityCode: testArea.otherCity,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/barangayCode' }] });
  });

  it('records nothing when the same values are saved again', async () => {
    const branch = await createBranch();
    const input = validBranch();
    const response = await call('PATCH', `/v1/admin/branches/${branch.id}`, {
      name: input.name,
      location: pin,
      contacts: [
        { type: 'phone', value: '+639171234567', label: 'Globe' },
        { type: 'phone', value: '045 888 1234', label: null },
        { type: 'messenger', value: 'https://m.me/testclinic', label: null },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect((await auditEntries(branch.id)).map((e) => e.action)).toEqual(['branch.create']);
  });

  it('404 for an unknown branch', async () => {
    const response = await call('PATCH', `/v1/admin/branches/${crypto.randomUUID()}`, {
      name: 'Nowhere',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /v1/admin/branches/:id', () => {
  it('returns contacts in display order', async () => {
    const business = await insertTestBusiness(db);
    const created = await call('POST', `/v1/admin/businesses/${business.id}/branches`, {
      ...validBranch(),
      barangayCode: null,
    });
    const { id } = created.json<BranchBody>();

    const response = await call('GET', `/v1/admin/branches/${id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ barangay: null });
    expect(response.json<BranchBody>().contacts.map((c) => c.value)).toEqual([
      '+639171234567',
      '+63458881234',
      'https://m.me/testclinic',
    ]);
  });

  it('404 for an unknown branch', async () => {
    expect((await call('GET', `/v1/admin/branches/${crypto.randomUUID()}`)).statusCode).toBe(404);
  });
});
