import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../client.ts';
import { testDatabaseUrl } from '../testing/index.ts';
import { psgcArea } from './psgc.ts';
import { serviceCategory, species } from './taxonomy.ts';

// The reference data the migrations ship (0004 PSGC, 0005 taxonomy). Every database,
// production and tests alike, starts with exactly this.
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

afterAll(async () => {
  await database.close();
});

const pampanga = '0305400000';
const angeles = '0330100000';

describe('PSGC: Pampanga', () => {
  it('has its 19 municipalities and 3 cities, including the City of Angeles', async () => {
    const children = await db
      .select({ name: psgcArea.name, level: psgcArea.level })
      .from(psgcArea)
      .where(eq(psgcArea.parentCode, pampanga));

    expect(children.filter((area) => area.level === 'municipality')).toHaveLength(19);
    expect(children.filter((area) => area.level === 'city').map((area) => area.name)).toEqual(
      expect.arrayContaining(['City of Angeles', 'City of San Fernando', 'Mabalacat City']),
    );
    expect(children).toHaveLength(22);
  });

  it("nests Angeles's 33 barangays under it", async () => {
    const barangays = await db
      .select({ name: psgcArea.name })
      .from(psgcArea)
      .where(eq(psgcArea.parentCode, angeles));
    expect(barangays).toHaveLength(33);
    expect(barangays.map((barangay) => barangay.name)).toContain('Balibago');
  });

  it('puts every barangay under a city or municipality', async () => {
    const parent = alias(psgcArea, 'parent');
    const misplaced = await db
      .select({ code: psgcArea.code })
      .from(psgcArea)
      .leftJoin(parent, eq(psgcArea.parentCode, parent.code))
      .where(
        and(
          eq(psgcArea.level, 'barangay'),
          sql`${psgcArea.code} not like '99%'`, // test fixtures
          sql`${parent.level} is distinct from 'city' and ${parent.level} is distinct from 'municipality'`,
        ),
      );
    expect(misplaced).toEqual([]);
  });

  it('keeps accented names intact', async () => {
    const rows = await db
      .select({ name: psgcArea.name })
      .from(psgcArea)
      .where(eq(psgcArea.name, 'Santo Niño'));
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('taxonomy', () => {
  it('lists the launch species in order', async () => {
    const rows = await db
      .select({ code: species.code })
      .from(species)
      .where(sql`${species.code} not like 'species_%'`) // test fixtures
      .orderBy(species.sortOrder);
    expect(rows.map((row) => row.code)).toEqual([
      'dog',
      'cat',
      'rabbit',
      'small_mammal',
      'bird',
      'reptile',
      'fish',
      'poultry',
      'livestock',
    ]);
  });

  it('nests every service category under a group', async () => {
    const groups = await db
      .select({ code: serviceCategory.code })
      .from(serviceCategory)
      .where(
        and(isNull(serviceCategory.parentId), sql`${serviceCategory.code} not like 'category_%'`),
      );
    expect(groups.map((group) => group.code).sort()).toEqual([
      'checkups',
      'diagnostics',
      'grooming_boarding',
      'hospital_care',
      'preventive_care',
      'surgery',
    ]);

    const categories = await db
      .select({ code: serviceCategory.code })
      .from(serviceCategory)
      .where(
        and(
          isNotNull(serviceCategory.parentId),
          sql`${serviceCategory.code} not like 'category_%'`,
        ),
      );
    expect(categories).toHaveLength(14);
  });

  it('finds categories by their Filipino synonyms', async () => {
    const find = async (term: string) => {
      const rows = await db
        .select({ code: serviceCategory.code })
        .from(serviceCategory)
        .where(
          and(
            sql`${term} = any(${serviceCategory.synonyms})`,
            sql`${serviceCategory.code} not like 'category_%'`, // test fixtures
          ),
        );
      return rows.map((row) => row.code);
    };
    expect(await find('kapon')).toEqual(['spay_neuter']);
    expect(await find('bakuna')).toEqual(['vaccination']);
    expect(await find('purga')).toEqual(['deworming']);
  });

  it('stores synonyms in lowercase', async () => {
    const rows = await db
      .select({ code: serviceCategory.code })
      .from(serviceCategory)
      .where(
        sql`exists (select 1 from unnest(${serviceCategory.synonyms}) as s where s <> lower(s))`,
      );
    expect(rows).toEqual([]);
  });
});
