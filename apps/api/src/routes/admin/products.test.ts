import { createDatabase, schema } from '@paw/db';
import { insertTestBusiness, insertTestUser, testDatabaseUrl } from '@paw/db/testing';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
  cookie = await sessionCookie(app, admin.id);
});

afterAll(async () => {
  await app.close();
  await database.close();
});

const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined && { payload }) });

const auditEntries = (businessId: string, action: string) =>
  db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.entityId, businessId), eq(schema.auditLog.action, action)));

interface ProductBody {
  id: string;
  businessId: string;
  name: string;
  category: string | null;
  price: number | null;
  availability: string;
}

async function addProduct(businessId: string, body: object) {
  const response = await call('POST', `/v1/admin/businesses/${businessId}/products`, body);
  expect(response.statusCode).toBe(201);
  return response.json<ProductBody>();
}

describe('POST /v1/admin/businesses/:id/products', () => {
  it('adds a product with defaults, and records it on the business', async () => {
    const business = await insertTestBusiness(db);
    const product = await addProduct(business.id, { name: 'Test kibble 1 kg', price: 45_000 });

    expect(product).toMatchObject({
      businessId: business.id,
      name: 'Test kibble 1 kg',
      category: null,
      price: 45_000,
      availability: 'available',
    });
    const [entry] = await auditEntries(business.id, 'business.create_product');
    expect(entry?.diff).toEqual({
      product: {
        from: null,
        to: { name: 'Test kibble 1 kg', category: null, price: 45_000, availability: 'available' },
      },
    });
  });

  it('400 for a missing name or a bad price', async () => {
    const business = await insertTestBusiness(db);
    const url = `/v1/admin/businesses/${business.id}/products`;

    const noName = await call('POST', url, { name: '  ' });
    expect(noName.statusCode).toBe(400);
    expect(noName.json()).toMatchObject({ errors: [{ pointer: '/name' }] });

    const negative = await call('POST', url, { name: 'Leash', price: -100 });
    expect(negative.json()).toMatchObject({ errors: [{ pointer: '/price' }] });
  });

  it('404 for an unknown business', async () => {
    const response = await call('POST', `/v1/admin/businesses/${crypto.randomUUID()}/products`, {
      name: 'Leash',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /v1/admin/businesses/:id/products', () => {
  it('lists by category (uncategorized last), then name', async () => {
    const business = await insertTestBusiness(db);
    await addProduct(business.id, { name: 'Shampoo' });
    await addProduct(business.id, { name: 'Kibble', category: 'Food' });
    await addProduct(business.id, { name: 'Collar', category: 'Accessories' });
    await addProduct(business.id, { name: 'Canned', category: 'Food' });

    const response = await call('GET', `/v1/admin/businesses/${business.id}/products`);
    expect(response.statusCode).toBe(200);
    expect(response.json<ProductBody[]>().map((p) => p.name)).toEqual([
      'Collar',
      'Canned',
      'Kibble',
      'Shampoo',
    ]);
  });

  it('404 for an unknown business', async () => {
    const response = await call('GET', `/v1/admin/businesses/${crypto.randomUUID()}/products`);
    expect(response.statusCode).toBe(404);
  });
});

describe('PATCH /v1/admin/products/:id', () => {
  it('changes only the fields sent and records from → to', async () => {
    const business = await insertTestBusiness(db);
    const product = await addProduct(business.id, { name: 'Kibble', price: 45_000 });

    const response = await call('PATCH', `/v1/admin/products/${product.id}`, {
      availability: 'out',
      category: '',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Kibble',
      price: 45_000,
      category: null,
      availability: 'out',
    });

    const [entry] = await auditEntries(business.id, 'business.update_product');
    expect(entry?.diff).toMatchObject({
      product: { from: { availability: 'available' }, to: { availability: 'out' } },
    });
  });

  it('records nothing when nothing changed', async () => {
    const business = await insertTestBusiness(db);
    const product = await addProduct(business.id, { name: 'Kibble' });
    await call('PATCH', `/v1/admin/products/${product.id}`, { name: 'Kibble', category: '' });

    expect(await auditEntries(business.id, 'business.update_product')).toHaveLength(0);
  });

  it('404 for an unknown product', async () => {
    const response = await call('PATCH', `/v1/admin/products/${crypto.randomUUID()}`, {
      name: 'X',
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /v1/admin/products/:id', () => {
  it('removes the product and records what it was', async () => {
    const business = await insertTestBusiness(db);
    const product = await addProduct(business.id, { name: 'Kibble' });

    const response = await call('DELETE', `/v1/admin/products/${product.id}`);
    expect(response.statusCode).toBe(204);
    expect((await call('GET', `/v1/admin/businesses/${business.id}/products`)).json()).toEqual([]);

    const [entry] = await auditEntries(business.id, 'business.delete_product');
    expect(entry?.diff).toMatchObject({ product: { from: { name: 'Kibble' }, to: null } });
    expect((await call('DELETE', `/v1/admin/products/${product.id}`)).statusCode).toBe(404);
  });
});
