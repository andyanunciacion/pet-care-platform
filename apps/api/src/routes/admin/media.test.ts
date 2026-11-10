import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestUser,
  testDatabaseUrl,
} from '@paw/db/testing';
import { MAX_PHOTOS_PER_BRANCH } from '@paw/domain';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { createMemoryStorage } from '../../storage.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let appWithoutStorage: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
let cookieWithoutStorage: string;
const storage = createMemoryStorage();
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  app = await buildApp({ env: testEnv(), storage });
  appWithoutStorage = await buildApp({ env: testEnv(), storage: null });
  await insertTestAreas(db);
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
  cookie = await sessionCookie(app, admin.id);
  cookieWithoutStorage = await sessionCookie(appWithoutStorage, admin.id);
});

afterAll(async () => {
  await app.close();
  await appWithoutStorage.close();
  await database.close();
});

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const call = (method: Method, url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload !== undefined && { payload }) });

const auditEntries = (entityId: string, action: string) =>
  db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.entityId, entityId), eq(schema.auditLog.action, action)));

type Purpose = 'branch_photo' | 'business_logo' | 'product_image';

interface MediaBody {
  id: string;
  kind: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  sortOrder: number;
}

/** Asks for an upload URL, then plays the browser's PUT. Returns the tmp key. */
async function upload(
  purpose: Purpose,
  ownerId: string,
  { contentType = 'image/webp', size = 150_000 } = {},
): Promise<string> {
  const response = await call('POST', '/v1/admin/uploads', {
    purpose,
    ownerId,
    contentType,
    contentLength: size,
  });
  expect(response.statusCode).toBe(200);
  const { storageKey } = response.json<{ storageKey: string }>();
  storage.put(storageKey, contentType, size);
  return storageKey;
}

const photo = (storageKey: string, alt = 'Clinic front with the PAW sign') => ({
  storageKey,
  alt,
  width: 1600,
  height: 1200,
});

async function addPhoto(branchId: string, alt?: string): Promise<MediaBody> {
  const key = await upload('branch_photo', branchId);
  const response = await call('POST', `/v1/admin/branches/${branchId}/photos`, photo(key, alt));
  expect(response.statusCode).toBe(201);
  return response.json<MediaBody>();
}

const newBranch = async () => insertTestBranch(db, (await insertTestBusiness(db)).id);

/** The storage key behind a public URL (the memory storage serves https://photos.test/<key>). */
const keyOf = (url: string) => url.replace('https://photos.test/', '');

describe('POST /v1/admin/uploads', () => {
  it('returns a presigned URL for a tmp key with the right extension', async () => {
    const branch = await newBranch();
    const response = await call('POST', '/v1/admin/uploads', {
      purpose: 'branch_photo',
      ownerId: branch.id,
      contentType: 'image/jpeg',
      contentLength: 1234,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ uploadUrl: string; storageKey: string; expiresAt: string }>();
    expect(body.storageKey).toMatch(/^tmp\/[0-9a-f-]{36}\.jpg$/);
    expect(body.uploadUrl).toContain(body.storageKey);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // Nothing is recorded until the upload is finalized.
    expect(await auditEntries(branch.id, 'branch.add_photo')).toHaveLength(0);
  });

  it('404 for an owner that does not exist', async () => {
    for (const purpose of ['branch_photo', 'business_logo', 'product_image'] as const) {
      const response = await call('POST', '/v1/admin/uploads', {
        purpose,
        ownerId: crypto.randomUUID(),
        contentType: 'image/webp',
        contentLength: 1000,
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it('400 for another type or an image over 2 MB', async () => {
    const branch = await newBranch();
    const base = { purpose: 'branch_photo', ownerId: branch.id };

    const png = await call('POST', '/v1/admin/uploads', {
      ...base,
      contentType: 'image/png',
      contentLength: 1000,
    });
    expect(png.statusCode).toBe(400);
    expect(png.json()).toMatchObject({ errors: [{ pointer: '/contentType' }] });

    const big = await call('POST', '/v1/admin/uploads', {
      ...base,
      contentType: 'image/webp',
      contentLength: 2 * 1024 * 1024 + 1,
    });
    expect(big.json()).toMatchObject({ errors: [{ pointer: '/contentLength' }] });
  });

  it(`409 once a branch has ${String(MAX_PHOTOS_PER_BRANCH)} photos`, async () => {
    const branch = await newBranch();
    await db.insert(schema.media).values(
      Array.from({ length: MAX_PHOTOS_PER_BRANCH }, (_, i) => ({
        kind: 'photo' as const,
        storageKey: `branches/${branch.id}/seed-${String(i)}.webp`,
        alt: `Photo ${String(i)}`,
        width: 10,
        height: 10,
        branchId: branch.id,
      })),
    );

    const response = await call('POST', '/v1/admin/uploads', {
      purpose: 'branch_photo',
      ownerId: branch.id,
      contentType: 'image/webp',
      contentLength: 1000,
    });
    expect(response.statusCode).toBe(409);
  });
});

describe('POST /v1/admin/branches/:id/photos', () => {
  it('moves the upload to the branch, records it, and lists photos in order', async () => {
    const branch = await newBranch();
    const tmpKey = await upload('branch_photo', branch.id);

    const response = await call('POST', `/v1/admin/branches/${branch.id}/photos`, photo(tmpKey));
    expect(response.statusCode).toBe(201);
    const added = response.json<MediaBody>();
    expect(added).toMatchObject({
      kind: 'photo',
      alt: 'Clinic front with the PAW sign',
      width: 1600,
      height: 1200,
      sortOrder: 0,
    });
    expect(keyOf(added.url)).toMatch(new RegExp(`^branches/${branch.id}/[0-9a-f-]{36}\\.webp$`));
    expect(storage.has(keyOf(added.url))).toBe(true);
    expect(storage.has(tmpKey)).toBe(false);

    const [entry] = await auditEntries(branch.id, 'branch.add_photo');
    expect(entry?.diff).toEqual({
      photo: {
        from: null,
        to: { alt: 'Clinic front with the PAW sign', width: 1600, height: 1200 },
      },
    });

    const second = await addPhoto(branch.id, 'Waiting area');
    const list = await call('GET', `/v1/admin/branches/${branch.id}/photos`);
    expect(list.json()).toMatchObject({
      branchId: branch.id,
      limit: MAX_PHOTOS_PER_BRANCH,
      photos: [{ id: added.id }, { id: second.id, sortOrder: 1 }],
    });
  });

  it('400 when the upload never arrived, or the key is not an upload', async () => {
    const branch = await newBranch();
    const url = `/v1/admin/branches/${branch.id}/photos`;

    const missing = await call('POST', url, photo(`tmp/${crypto.randomUUID()}.webp`));
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ errors: [{ pointer: '/storageKey' }] });

    const foreign = await call('POST', url, photo(`branches/${branch.id}/someone-else.webp`));
    expect(foreign.statusCode).toBe(400);
    expect(foreign.json()).toMatchObject({ errors: [{ pointer: '/storageKey' }] });
  });

  it('400 when the uploaded object is too big or not what the key says', async () => {
    const branch = await newBranch();
    const url = `/v1/admin/branches/${branch.id}/photos`;

    const bigKey = `tmp/${crypto.randomUUID()}.webp`;
    storage.put(bigKey, 'image/webp', 3 * 1024 * 1024);
    expect((await call('POST', url, photo(bigKey))).statusCode).toBe(400);

    const pngKey = `tmp/${crypto.randomUUID()}.webp`;
    storage.put(pngKey, 'image/png', 1000);
    expect((await call('POST', url, photo(pngKey))).statusCode).toBe(400);
    expect(await auditEntries(branch.id, 'branch.add_photo')).toHaveLength(0);
  });

  it('400 for a missing alt text or an image larger than the resize limit', async () => {
    const branch = await newBranch();
    const key = await upload('branch_photo', branch.id);
    const url = `/v1/admin/branches/${branch.id}/photos`;

    const noAlt = await call('POST', url, { ...photo(key), alt: '   ' });
    expect(noAlt.json()).toMatchObject({ errors: [{ pointer: '/alt' }] });
    const tooWide = await call('POST', url, { ...photo(key), width: 4000 });
    expect(tooWide.statusCode).toBe(400);
  });
});

describe('PUT /v1/admin/branches/:id/photos/order', () => {
  it('saves the new order and records it by alt text', async () => {
    const branch = await newBranch();
    const a = await addPhoto(branch.id, 'Front');
    const b = await addPhoto(branch.id, 'Exam room');

    const response = await call('PUT', `/v1/admin/branches/${branch.id}/photos/order`, {
      ids: [b.id, a.id],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ photos: MediaBody[] }>().photos.map((p) => p.alt)).toEqual([
      'Exam room',
      'Front',
    ]);
    const [entry] = await auditEntries(branch.id, 'branch.reorder_photos');
    expect(entry?.diff).toEqual({
      photoOrder: { from: ['Front', 'Exam room'], to: ['Exam room', 'Front'] },
    });
  });

  it('400 when the ids are not exactly the branch photos', async () => {
    const branch = await newBranch();
    const a = await addPhoto(branch.id);
    await addPhoto(branch.id);

    const response = await call('PUT', `/v1/admin/branches/${branch.id}/photos/order`, {
      ids: [a.id],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ errors: [{ pointer: '/ids' }] });
  });
});

describe('PUT /v1/admin/businesses/:id/logo', () => {
  it('sets the logo, and replacing it deletes the old file', async () => {
    const business = await insertTestBusiness(db);
    const url = `/v1/admin/businesses/${business.id}/logo`;
    const logo = (key: string, alt: string) => ({ storageKey: key, alt, width: 512, height: 512 });

    const first = await call(
      'PUT',
      url,
      logo(await upload('business_logo', business.id), 'Old logo'),
    );
    expect(first.statusCode).toBe(200);
    const oldKey = keyOf(first.json<MediaBody>().url);
    expect(oldKey).toMatch(new RegExp(`^businesses/${business.id}/logo-`));

    const second = await call(
      'PUT',
      url,
      logo(await upload('business_logo', business.id), 'New logo'),
    );
    expect(second.json()).toMatchObject({ kind: 'logo', alt: 'New logo' });
    expect(storage.has(oldKey)).toBe(false);

    const mediaResponse = await call('GET', `/v1/admin/businesses/${business.id}/media`);
    expect(mediaResponse.json()).toMatchObject({ logo: { alt: 'New logo' }, productImages: [] });

    const entries = await auditEntries(business.id, 'business.set_logo');
    expect(entries.map((e) => e.diff)).toContainEqual({
      logo: {
        from: { alt: 'Old logo', width: 512, height: 512 },
        to: { alt: 'New logo', width: 512, height: 512 },
      },
    });
  });

  it('400 for a logo bigger than 512 pixels', async () => {
    const business = await insertTestBusiness(db);
    const key = await upload('business_logo', business.id);
    const response = await call('PUT', `/v1/admin/businesses/${business.id}/logo`, {
      storageKey: key,
      alt: 'Logo',
      width: 1600,
      height: 1600,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('PUT /v1/admin/products/:id/image', () => {
  it("sets the product's image, records it on the business, and replaces the old one", async () => {
    const business = await insertTestBusiness(db);
    const created = await call('POST', `/v1/admin/businesses/${business.id}/products`, {
      name: 'Test kibble',
    });
    const productId = created.json<{ id: string }>().id;
    const url = `/v1/admin/products/${productId}/image`;
    const image = (key: string, alt: string) => ({
      storageKey: key,
      alt,
      width: 1200,
      height: 900,
    });

    const first = await call(
      'PUT',
      url,
      image(await upload('product_image', productId), 'Bag front'),
    );
    expect(first.statusCode).toBe(200);
    const oldKey = keyOf(first.json<MediaBody>().url);
    await call('PUT', url, image(await upload('product_image', productId), 'Bag back'));
    expect(storage.has(oldKey)).toBe(false);

    const mediaResponse = await call('GET', `/v1/admin/businesses/${business.id}/media`);
    expect(mediaResponse.json()).toMatchObject({
      productImages: [{ productId, image: { alt: 'Bag back' } }],
    });
    const entries = await auditEntries(business.id, 'business.set_product_image');
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.diff)).toContainEqual({
      productImage: {
        from: null,
        to: { product: 'Test kibble', alt: 'Bag front', width: 1200, height: 900 },
      },
    });
  });
});

describe('PATCH and DELETE /v1/admin/media/:id', () => {
  it('edits the alt text and records it on the owner', async () => {
    const branch = await newBranch();
    const added = await addPhoto(branch.id, 'Front');

    const response = await call('PATCH', `/v1/admin/media/${added.id}`, { alt: 'Front door' });
    expect(response.json()).toMatchObject({ alt: 'Front door' });
    const [entry] = await auditEntries(branch.id, 'branch.update_photo');
    expect(entry?.diff).toMatchObject({
      photo: { from: { alt: 'Front' }, to: { alt: 'Front door' } },
    });
  });

  it('deletes the row and the file, and records it', async () => {
    const branch = await newBranch();
    const added = await addPhoto(branch.id, 'Front');

    const response = await call('DELETE', `/v1/admin/media/${added.id}`);
    expect(response.statusCode).toBe(204);
    expect(storage.has(keyOf(added.url))).toBe(false);
    expect((await call('GET', `/v1/admin/branches/${branch.id}/photos`)).json()).toMatchObject({
      photos: [],
    });
    const [entry] = await auditEntries(branch.id, 'branch.delete_photo');
    expect(entry?.diff).toMatchObject({ photo: { from: { alt: 'Front' }, to: null } });

    expect((await call('DELETE', `/v1/admin/media/${added.id}`)).statusCode).toBe(404);
  });
});

describe('without photo storage', () => {
  it('answers 503 with a message saying what to set up', async () => {
    const branch = await newBranch();
    const response = await appWithoutStorage.inject({
      method: 'GET',
      url: `/v1/admin/branches/${branch.id}/photos`,
      headers: { cookie: cookieWithoutStorage },
    });

    expect(response.statusCode).toBe(503);
    const problem = response.json<{ status: number; detail: string }>();
    expect(problem.status).toBe(503);
    expect(problem.detail).toMatch(/R2_/);
  });
});
