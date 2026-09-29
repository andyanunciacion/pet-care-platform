import { customType, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from './client.ts';
import { runMigrations } from './migrate.ts';
import { testDatabaseUrl } from './testing/index.ts';

// Integration tests against this run's fresh database (see src/testing/global-setup.ts).
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

afterAll(async () => {
  await database.close();
});

describe('createDatabase', () => {
  it('pings a reachable database', async () => {
    await expect(database.ping()).resolves.toBeUndefined();
  });

  it('fails to ping an unreachable database', async () => {
    // Nothing listens on port 1, so the connection is refused.
    const unreachable = createDatabase({ connectionString: 'postgres://paw:paw@127.0.0.1:1/paw' });
    await expect(unreachable.ping()).rejects.toThrow();
    await unreachable.close();
  });
});

describe('migrations', () => {
  it('enable exactly the extensions we rely on', async () => {
    const { rows } = await db.execute<{ extname: string }>(
      sql`select extname from pg_extension order by extname`,
    );
    // plpgsql is built into Postgres. Anything else would mean tests depend on
    // something production doesn't have.
    expect(rows.map((row) => row.extname)).toEqual(['pg_trgm', 'plpgsql', 'postgis']);
  });

  it('can run again safely (already-applied migrations are skipped)', async () => {
    await expect(runMigrations(testDatabaseUrl())).resolves.toBeUndefined();
  });
});

describe('a table with PostGIS and pg_trgm', () => {
  // A throwaway table, only to prove the pieces work together. Real tables live in
  // src/schema and arrive with slice 1.
  const geographyPoint = customType<{ data: string }>({
    dataType: () => 'geography(Point, 4326)',
  });
  const testPlace = pgTable('test_place', {
    id: serial().primaryKey(),
    name: text().notNull(),
    location: geographyPoint().notNull(),
  });
  // ST_Point takes longitude first, then latitude.
  const point = (lng: number, lat: number) =>
    sql`ST_SetSRID(ST_Point(${lng}, ${lat}), 4326)::geography`;
  const angelesCity = point(120.5887, 15.145);

  it('creates, inserts and queries by distance', async () => {
    await db.execute(sql`
      create table test_place (
        id serial primary key,
        name text not null,
        location geography(Point, 4326) not null
      )
    `);
    await db.insert(testPlace).values([
      { name: 'Angeles clinic', location: point(120.5887, 15.145) },
      { name: 'Clark clinic', location: point(120.5402, 15.1854) },
      { name: 'Manila clinic', location: point(120.9842, 14.5995) },
    ]);

    const within10km = await db
      .select({
        name: testPlace.name,
        km: sql<number>`round((ST_Distance(${testPlace.location}, ${angelesCity}) / 1000)::numeric, 1)::float`,
      })
      .from(testPlace)
      .where(sql`ST_DWithin(${testPlace.location}, ${angelesCity}, 10000)`)
      .orderBy(sql`${testPlace.location} <-> ${angelesCity}`);

    expect(within10km).toEqual([
      { name: 'Angeles clinic', km: 0 },
      { name: 'Clark clinic', km: 6.9 },
    ]);
  });

  it('matches typos with trigram similarity', async () => {
    const { rows } = await db.execute<{ matches: boolean }>(
      sql`select similarity('kapon', 'kapn') > 0.3 as matches`,
    );
    expect(rows[0]?.matches).toBe(true);
  });
});
