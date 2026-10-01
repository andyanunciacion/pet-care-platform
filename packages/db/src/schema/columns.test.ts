import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../client.ts';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  testDatabaseUrl,
} from '../testing/index.ts';
import { business } from './business.ts';
import { parsePointEwkb } from './columns.ts';

const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  await insertTestAreas(db);
});

afterAll(async () => {
  await database.close();
});

describe('uuid_generate_v7()', () => {
  it('generates version 7 UUIDs with the RFC 9562 variant', async () => {
    const { rows } = await db.execute<{ id: string }>(sql`select uuid_generate_v7()::text as id`);
    // xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('starts with the current time in milliseconds, so ids sort by creation time', async () => {
    const generate = async () => {
      const { rows } = await db.execute<{ id: string }>(sql`select uuid_generate_v7()::text as id`);
      return rows[0]?.id ?? '';
    };
    // The first 48 bits (12 hex digits) are the Unix time in milliseconds.
    const millis = (id: string) => Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16);

    const first = await generate();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await generate();

    // Generous margin: Docker's clock can drift a little from the host's.
    expect(Math.abs(millis(first) - Date.now())).toBeLessThan(5_000);
    expect(second > first).toBe(true);
  });

  it('is the default for id columns', async () => {
    const row = await insertTestBusiness(db);
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });
});

describe('geographyPoint', () => {
  it('round-trips { lng, lat } through the database', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const row = await insertTestBranch(db, businessId, {
      location: { lng: 120.5402, lat: 15.1854 },
    });
    expect(row.location).toEqual({ lng: 120.5402, lat: 15.1854 });
  });

  it('measures distances in meters', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const angeles = await insertTestBranch(db, businessId, {
      location: { lng: 120.5887, lat: 15.145 },
    });
    const clark = await insertTestBranch(db, businessId, {
      location: { lng: 120.5402, lat: 15.1854 },
    });
    const { rows } = await db.execute<{ km: number }>(sql`
      select round((ST_Distance(a.location, b.location) / 1000)::numeric, 1)::float as km
      from branch a, branch b where a.id = ${angeles.id} and b.id = ${clark.id}
    `);
    expect(rows[0]?.km).toBe(6.9);
  });

  it('parses big-endian EWKB too', () => {
    // POINT(120.5 15.25) with SRID 4326, written big-endian by hand.
    const hex = '00' + '20000001' + '000010e6' + '405e200000000000' + '402e800000000000';
    expect(parsePointEwkb(hex)).toEqual({ lng: 120.5, lat: 15.25 });
  });

  it('rejects anything but a point', () => {
    // A little-endian LINESTRING header (type 2) without SRID.
    expect(() => parsePointEwkb('0102000000')).toThrow('Expected a point');
  });
});

describe('timestamps', () => {
  it('refreshes updatedAt when a row is updated through Drizzle', async () => {
    const created = await insertTestBusiness(db);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const [updated] = await db
      .update(business)
      .set({ name: 'Renamed Clinic' })
      .where(eq(business.id, created.id))
      .returning();

    expect(updated?.createdAt).toEqual(created.createdAt);
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });
});
