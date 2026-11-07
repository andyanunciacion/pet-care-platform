import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestCategory,
  insertTestSpecies,
  insertTestUser,
  testDatabaseUrl,
} from '@paw/db/testing';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

// Made-up taxonomy (never the real reference data, which other tests check).
let group: Awaited<ReturnType<typeof insertTestCategory>>;
let category: Awaited<ReturnType<typeof insertTestCategory>>;
let otherCategory: Awaited<ReturnType<typeof insertTestCategory>>;
let dog: Awaited<ReturnType<typeof insertTestSpecies>>;
let cat: Awaited<ReturnType<typeof insertTestSpecies>>;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
  cookie = await sessionCookie(app, admin.id);

  group = await insertTestCategory(db, { name: 'Test surgery', sortOrder: 1 });
  category = await insertTestCategory(db, { name: 'Test spay', parentId: group.id, sortOrder: 1 });
  otherCategory = await insertTestCategory(db, {
    name: 'Test dental',
    parentId: group.id,
    sortOrder: 2,
  });
  dog = await insertTestSpecies(db, { name: 'Test dog', sortOrder: 1 });
  cat = await insertTestSpecies(db, { name: 'Test cat', sortOrder: 2 });
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined && { payload }) });

const auditEntries = (entityId: string, action: string) =>
  db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.entityId, entityId), eq(schema.auditLog.action, action)));

/** A business with two branches: "Main" (first) and "Annex". */
async function businessWithBranches() {
  const business = await insertTestBusiness(db);
  const main = await insertTestBranch(db, business.id, { name: 'Main' });
  const annex = await insertTestBranch(db, business.id, { name: 'Annex' });
  return { business, main, annex };
}

interface ServiceBody {
  id: string;
  branchId: string;
  category: { id: string; name: string; groupName: string | null };
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string;
  priceNote: string | null;
  description: string | null;
  speciesIds: string[];
}

interface ServicesBody {
  branchId: string;
  businessId: string;
  otherBranches: { id: string; name: string }[];
  speciesTreated: string[];
  services: ServiceBody[];
}

const kapon = () => ({
  categoryId: category.id,
  name: 'Kapon',
  priceMin: 150_000,
  priceMax: 300_000,
  priceNote: 'Depends on weight',
  speciesIds: [cat.id, dog.id],
});

async function addService(branchId: string, body: object = kapon()) {
  const response = await call('POST', `/v1/admin/branches/${branchId}/services`, body);
  expect(response.statusCode).toBe(201);
  return response.json<ServiceBody>();
}

const listServices = async (branchId: string) =>
  (await call('GET', `/v1/admin/branches/${branchId}/services`)).json<ServicesBody>();

describe('GET /v1/admin/branches/:id/services', () => {
  it('returns an empty list and the other branches for a new branch', async () => {
    const { business, main, annex } = await businessWithBranches();
    const response = await call('GET', `/v1/admin/branches/${main.id}/services`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      branchId: main.id,
      businessId: business.id,
      otherBranches: [{ id: annex.id, name: 'Annex' }],
      speciesTreated: [],
      services: [],
    });
  });

  it('sorts by category, then the order they were added', async () => {
    const { main } = await businessWithBranches();
    await addService(main.id, { categoryId: otherCategory.id, name: 'Scaling' });
    await addService(main.id, { categoryId: category.id, name: 'Neuter' });
    await addService(main.id, { categoryId: category.id, name: 'Spay' });

    const { services } = await listServices(main.id);
    expect(services.map((s) => s.name)).toEqual(['Neuter', 'Spay', 'Scaling']);
  });

  it('404 for an unknown branch', async () => {
    const response = await call('GET', `/v1/admin/branches/${crypto.randomUUID()}/services`);
    expect(response.statusCode).toBe(404);
  });
});

describe('PUT /v1/admin/branches/:id/species', () => {
  it('replaces the species treated and records the names', async () => {
    const { main } = await businessWithBranches();
    const url = `/v1/admin/branches/${main.id}/species`;
    await call('PUT', url, { speciesIds: [dog.id] });

    const response = await call('PUT', url, { speciesIds: [cat.id, dog.id, cat.id] });
    expect(response.statusCode).toBe(200);
    // In the species' display order, without the duplicate.
    expect(response.json<ServicesBody>().speciesTreated).toEqual([dog.id, cat.id]);

    const entries = await auditEntries(main.id, 'branch.update_species');
    expect(entries.map((e) => e.diff)).toContainEqual({
      speciesTreated: { from: ['Test dog'], to: ['Test dog', 'Test cat'] },
    });
  });

  it('records nothing when the list is the same', async () => {
    const { main } = await businessWithBranches();
    const url = `/v1/admin/branches/${main.id}/species`;
    await call('PUT', url, { speciesIds: [dog.id] });
    await call('PUT', url, { speciesIds: [dog.id] });

    expect(await auditEntries(main.id, 'branch.update_species')).toHaveLength(1);
  });

  it('400 for a species that does not exist', async () => {
    const { main } = await businessWithBranches();
    const response = await call('PUT', `/v1/admin/branches/${main.id}/species`, {
      speciesIds: [crypto.randomUUID()],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/speciesIds' }] });
  });
});

describe('POST /v1/admin/branches/:id/services', () => {
  it('adds a service with its species and price, and records it', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id);

    expect(service).toMatchObject({
      branchId: main.id,
      category: { id: category.id, name: 'Test spay', groupName: 'Test surgery' },
      name: 'Kapon',
      priceMin: 150_000,
      priceMax: 300_000,
      priceUnit: 'per_visit',
      priceNote: 'Depends on weight',
      description: null,
      speciesIds: [dog.id, cat.id],
    });

    const [entry] = await auditEntries(main.id, 'branch.create_service');
    expect(entry?.diff).toEqual({
      service: {
        from: null,
        to: {
          category: 'Test spay',
          name: 'Kapon',
          description: null,
          priceMin: 150_000,
          priceMax: 300_000,
          priceUnit: 'per_visit',
          priceNote: 'Depends on weight',
          species: ['Test dog', 'Test cat'],
        },
      },
    });
  });

  it('stores empty text as null', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id, {
      categoryId: category.id,
      name: '  Neuter  ',
      description: '   ',
      priceNote: '',
    });
    expect(service).toMatchObject({ name: 'Neuter', description: null, priceNote: null });
  });

  it('400 for a category group instead of a specific service', async () => {
    const { main } = await businessWithBranches();
    const response = await call('POST', `/v1/admin/branches/${main.id}/services`, {
      ...kapon(),
      categoryId: group.id,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/categoryId' }] });
  });

  it('400 at /priceMax for a maximum without a minimum or below it', async () => {
    const { main } = await businessWithBranches();
    const url = `/v1/admin/branches/${main.id}/services`;

    const withoutMin = await call('POST', url, { ...kapon(), priceMin: null });
    expect(withoutMin.statusCode).toBe(400);
    expect(withoutMin.json()).toMatchObject({ errors: [{ pointer: '/priceMax' }] });

    const belowMin = await call('POST', url, { ...kapon(), priceMax: 100_000 });
    expect(belowMin.statusCode).toBe(400);
    expect(belowMin.json()).toMatchObject({ errors: [{ pointer: '/priceMax' }] });
  });

  it('400 for a negative, fractional or absurd price', async () => {
    const { main } = await businessWithBranches();
    const url = `/v1/admin/branches/${main.id}/services`;
    for (const priceMin of [-1, 1.5, 100_000_001]) {
      const response = await call('POST', url, { ...kapon(), priceMin, priceMax: null });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ errors: [{ pointer: '/priceMin' }] });
    }
  });

  it('accepts a single price ("From ₱…") and no price ("Call for price")', async () => {
    const { main } = await businessWithBranches();
    const from = await addService(main.id, { ...kapon(), priceMax: null });
    const callForPrice = await addService(main.id, { ...kapon(), priceMin: null, priceMax: null });
    expect(from).toMatchObject({ priceMin: 150_000, priceMax: null });
    expect(callForPrice).toMatchObject({ priceMin: null, priceMax: null });
  });

  it('404 for an unknown branch', async () => {
    const response = await call(
      'POST',
      `/v1/admin/branches/${crypto.randomUUID()}/services`,
      kapon(),
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /v1/admin/services/:id', () => {
  it('changes only the fields sent and records from → to', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id);

    const response = await call('PATCH', `/v1/admin/services/${service.id}`, {
      priceMax: 350_000,
      speciesIds: [dog.id],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Kapon',
      priceMin: 150_000,
      priceMax: 350_000,
      speciesIds: [dog.id],
    });

    const [entry] = await auditEntries(main.id, 'branch.update_service');
    expect(entry?.diff).toMatchObject({
      service: {
        from: { priceMax: 300_000, species: ['Test dog', 'Test cat'] },
        to: { priceMax: 350_000, species: ['Test dog'] },
      },
    });
  });

  it('records nothing when nothing changed (species in another order count as the same)', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id);
    const response = await call('PATCH', `/v1/admin/services/${service.id}`, {
      name: 'Kapon',
      speciesIds: [dog.id, cat.id],
    });

    expect(response.statusCode).toBe(200);
    expect(await auditEntries(main.id, 'branch.update_service')).toHaveLength(0);
  });

  it('checks the price range against the saved values', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id);
    const response = await call('PATCH', `/v1/admin/services/${service.id}`, {
      priceMin: 400_000,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/priceMax' }] });
  });

  it('404 for an unknown service', async () => {
    const response = await call('PATCH', `/v1/admin/services/${crypto.randomUUID()}`, {
      name: 'X',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /v1/admin/services/:id', () => {
  it('removes the service and its species links, and records what it was', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id);

    const response = await call('DELETE', `/v1/admin/services/${service.id}`);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect((await listServices(main.id)).services).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.branchServiceSpecies)
        .where(eq(schema.branchServiceSpecies.branchServiceId, service.id)),
    ).toEqual([]);

    const [entry] = await auditEntries(main.id, 'branch.delete_service');
    expect(entry?.diff).toMatchObject({ service: { from: { name: 'Kapon' }, to: null } });
  });

  it('404 the second time', async () => {
    const { main } = await businessWithBranches();
    const service = await addService(main.id);
    await call('DELETE', `/v1/admin/services/${service.id}`);
    expect((await call('DELETE', `/v1/admin/services/${service.id}`)).statusCode).toBe(404);
  });
});

describe('POST /v1/admin/services/:id/copy-to-branches', () => {
  it('a dry run reports the plan and writes nothing', async () => {
    const { business, main, annex } = await businessWithBranches();
    const third = await insertTestBranch(db, business.id, { name: 'Bypass' });
    const service = await addService(main.id);
    // Same category, same name in other case and spacing: overwritten.
    await addService(third.id, { ...kapon(), name: ' kapon ', priceMin: 100_000, priceMax: null });
    // Bypass already treats dogs; Annex treats nothing yet.
    await call('PUT', `/v1/admin/branches/${third.id}/species`, { speciesIds: [dog.id] });

    const response = await call('POST', `/v1/admin/services/${service.id}/copy-to-branches`, {
      dryRun: true,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      dryRun: true,
      added: [{ id: annex.id, name: 'Annex', speciesAdded: ['Test dog', 'Test cat'] }],
      updated: [{ id: third.id, name: 'Bypass', speciesAdded: ['Test cat'] }],
      unchanged: [],
    });

    expect((await listServices(annex.id)).services).toEqual([]);
    expect((await listServices(annex.id)).speciesTreated).toEqual([]);
    expect((await listServices(third.id)).services[0]).toMatchObject({ priceMin: 100_000 });
  });

  it("adds the service's species to each branch's species treated, in one audit entry", async () => {
    const { main, annex } = await businessWithBranches();
    const service = await addService(main.id);
    await call('PUT', `/v1/admin/branches/${annex.id}/species`, { speciesIds: [dog.id] });

    await call('POST', `/v1/admin/services/${service.id}/copy-to-branches`, { dryRun: false });

    expect((await listServices(annex.id)).speciesTreated).toEqual([dog.id, cat.id]);
    const entries = await auditEntries(annex.id, 'branch.copy_service');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.diff).toMatchObject({
      service: { from: null, to: { name: 'Kapon' } },
      speciesTreated: { from: ['Test dog'], to: ['Test dog', 'Test cat'] },
    });
  });

  it('adds missing species even when the service there is already the same', async () => {
    const { main, annex } = await businessWithBranches();
    const service = await addService(main.id);
    await addService(annex.id);

    const response = await call('POST', `/v1/admin/services/${service.id}/copy-to-branches`, {
      dryRun: false,
    });
    expect(response.json()).toMatchObject({
      unchanged: [{ id: annex.id, speciesAdded: ['Test dog', 'Test cat'] }],
    });
    expect((await listServices(annex.id)).speciesTreated).toEqual([dog.id, cat.id]);
    const [entry] = await auditEntries(annex.id, 'branch.copy_service');
    expect(entry?.diff).toEqual({
      speciesTreated: { from: [], to: ['Test dog', 'Test cat'] },
    });
  });

  it('adds a copy where there is no match and overwrites the match', async () => {
    const { business, main, annex } = await businessWithBranches();
    const third = await insertTestBranch(db, business.id, { name: 'Bypass' });
    const service = await addService(main.id);
    await addService(third.id, { ...kapon(), name: 'KAPON', priceMin: 100_000, priceMax: null });
    // Same name, other category: not a match, left alone.
    await addService(third.id, { categoryId: otherCategory.id, name: 'Kapon' });

    const response = await call('POST', `/v1/admin/services/${service.id}/copy-to-branches`, {
      dryRun: false,
    });
    expect(response.json()).toMatchObject({
      dryRun: false,
      added: [{ id: annex.id }],
      updated: [{ id: third.id }],
    });

    const copied = { name: 'Kapon', priceMin: 150_000, priceMax: 300_000 };
    expect((await listServices(annex.id)).services).toMatchObject([
      { ...copied, speciesIds: [dog.id, cat.id] },
    ]);
    const thirdServices = (await listServices(third.id)).services;
    expect(thirdServices).toHaveLength(2);
    expect(thirdServices.find((s) => s.category.id === category.id)).toMatchObject(copied);
    expect(thirdServices.find((s) => s.category.id === otherCategory.id)).toMatchObject({
      priceMin: null,
    });

    expect(await auditEntries(annex.id, 'branch.copy_service')).toHaveLength(1);
    const [overwrite] = await auditEntries(third.id, 'branch.copy_service');
    expect(overwrite?.diff).toMatchObject({
      service: { from: { name: 'KAPON', priceMin: 100_000 }, to: { name: 'Kapon' } },
    });
  });

  it('reports an identical match as unchanged and records nothing for it', async () => {
    const { main, annex } = await businessWithBranches();
    const service = await addService(main.id);
    await addService(annex.id);
    await call('PUT', `/v1/admin/branches/${annex.id}/species`, { speciesIds: [dog.id, cat.id] });

    const response = await call('POST', `/v1/admin/services/${service.id}/copy-to-branches`, {
      dryRun: false,
    });
    expect(response.json()).toMatchObject({
      added: [],
      updated: [],
      unchanged: [{ id: annex.id, speciesAdded: [] }],
    });
    expect(await auditEntries(annex.id, 'branch.copy_service')).toHaveLength(0);
  });

  it('does nothing for a business with one branch', async () => {
    const business = await insertTestBusiness(db);
    const only = await insertTestBranch(db, business.id);
    const service = await addService(only.id);

    const response = await call('POST', `/v1/admin/services/${service.id}/copy-to-branches`, {
      dryRun: false,
    });
    expect(response.json()).toEqual({ dryRun: false, added: [], updated: [], unchanged: [] });
  });

  it('404 for an unknown service', async () => {
    const response = await call(
      'POST',
      `/v1/admin/services/${crypto.randomUUID()}/copy-to-branches`,
      { dryRun: true },
    );
    expect(response.statusCode).toBe(404);
  });
});
