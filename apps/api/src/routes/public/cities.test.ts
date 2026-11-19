import { randomInt } from 'node:crypto';
import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  testArea,
  testDatabaseUrl,
  uniqueSlug,
} from '@paw/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import type { Cities } from '../../services/cities.ts';
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

/**
 * A fake city of this test's own in the test province ("99…" codes are never real), since
 * other test files publish branches in the shared test city.
 */
async function insertOwnCity(): Promise<string> {
  const code = `998${String(randomInt(10_000_000)).padStart(7, '0')}`;
  await db.insert(schema.psgcArea).values({
    code,
    name: `Own Test City ${code}`,
    level: 'city',
    parentCode: testArea.province,
    slug: uniqueSlug('city'),
  });
  return code;
}

async function getCities(): Promise<Cities> {
  const response = await app.inject({ method: 'GET', url: '/v1/cities' });
  expect(response.statusCode).toBe(200);
  return response.json<Cities>();
}

describe('GET /v1/cities', () => {
  it('lists a city once it has a published branch, once, with its province', async () => {
    const code = await insertOwnCity();
    const { id } = await insertTestBusiness(db, { listingStatus: 'published' });
    await insertTestBranch(db, id, { cityCode: code, barangayCode: null });
    await insertTestBranch(db, id, { cityCode: code, barangayCode: null });

    const { cities, defaultCode } = await getCities();
    const listed = cities.filter((city) => city.code === code);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.province).toEqual({
      code: testArea.province,
      name: 'Test Province',
      slug: 'test-province',
    });
    expect(defaultCode).toBe('0330100000');
  });

  it('leaves out cities whose only listings are hidden or closed', async () => {
    const code = await insertOwnCity();
    const hidden = await insertTestBusiness(db, { listingStatus: 'hidden' });
    await insertTestBranch(db, hidden.id, { cityCode: code, barangayCode: null });
    const published = await insertTestBusiness(db, { listingStatus: 'published' });
    await insertTestBranch(db, published.id, {
      cityCode: code,
      barangayCode: null,
      listingStatus: 'permanently_closed',
    });

    const { cities } = await getCities();
    expect(cities.map((city) => city.code)).not.toContain(code);
  });
});
