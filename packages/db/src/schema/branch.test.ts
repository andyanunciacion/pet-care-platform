import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../client.ts';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  testDatabaseUrl,
  uniqueSlug,
  violatedConstraint,
} from '../testing/index.ts';
import { branch, branchContact, branchHours, branchHoursException } from './branch.ts';
import { business } from './business.ts';
import { psgcArea } from './psgc.ts';

// These tests prove the database itself enforces the data rules, as a last line of
// defense behind the API's Zod validation.
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

beforeAll(async () => {
  await insertTestAreas(db);
});

afterAll(async () => {
  await database.close();
});

async function newBranch() {
  const { id: businessId } = await insertTestBusiness(db);
  return insertTestBranch(db, businessId);
}

describe('psgc_area', () => {
  it('requires 10-digit codes', async () => {
    const query = db.insert(psgcArea).values({ code: '123', name: 'Too short', level: 'province' });
    expect(await violatedConstraint(query)).toBe('psgc_area_code_format');
  });
});

describe('business', () => {
  it('starts unclaimed and hidden', async () => {
    const row = await insertTestBusiness(db);
    expect(row).toMatchObject({ claimStatus: 'unclaimed', listingStatus: 'hidden' });
  });

  it('has a unique slug', async () => {
    const { slug } = await insertTestBusiness(db);
    expect(await violatedConstraint(insertTestBusiness(db, { slug }))).toBe('business_slug_unique');
  });

  it('rejects slugs that are not lowercase words joined by hyphens', async () => {
    for (const slug of ['Paw Vet', 'paw--vet', '-paw', 'paw_vet']) {
      expect(await violatedConstraint(insertTestBusiness(db, { slug }))).toBe(
        'business_slug_format',
      );
    }
  });

  it('only accepts launch business types', async () => {
    const query = db.execute(sql`
      insert into business (name, slug, type) values ('Groomer', ${uniqueSlug()}, 'groomer')
    `);
    await expect(query).rejects.toThrow();
  });

  it("can't be deleted while it has branches", async () => {
    const { businessId } = await newBranch();
    const query = db.delete(business).where(eq(business.id, businessId));
    expect(await violatedConstraint(query)).toBe('branch_business_id_business_id_fk');
  });
});

describe('branch', () => {
  it('stores is24h in the is_24h column', async () => {
    const row = await newBranch();
    const { rows } = await db.execute<{ is_24h: boolean }>(
      sql`select is_24h from branch where id = ${row.id}`,
    );
    expect(rows[0]?.is_24h).toBe(false);
  });

  it('has a slug unique within its business, reusable by other businesses', async () => {
    const first = await newBranch();
    const sameBusiness = insertTestBranch(db, first.businessId, { slug: first.slug });
    expect(await violatedConstraint(sameBusiness)).toBe('branch_businessId_slug_unique');

    const { id: otherBusinessId } = await insertTestBusiness(db);
    await expect(
      insertTestBranch(db, otherBusinessId, { slug: first.slug }),
    ).resolves.toBeDefined();
  });

  it('records when and by whom hours were confirmed, both or neither', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const onlyDate = insertTestBranch(db, businessId, { hoursConfirmedAt: new Date() });
    expect(await violatedConstraint(onlyDate)).toBe('branch_hours_confirmed_pair');

    const onlyWho = insertTestBranch(db, businessId, { hoursConfirmedBy: 'paw_ops' });
    expect(await violatedConstraint(onlyWho)).toBe('branch_hours_confirmed_pair');

    const both = insertTestBranch(db, businessId, {
      hoursConfirmedAt: new Date(),
      hoursConfirmedBy: 'paw_ops',
    });
    await expect(both).resolves.toBeDefined();
  });

  it('requires real PSGC codes', async () => {
    const { id: businessId } = await insertTestBusiness(db);
    const query = insertTestBranch(db, businessId, { cityCode: '9999999999' });
    expect(await violatedConstraint(query)).toBe('branch_city_code_psgc_area_code_fk');
  });

  it('takes its contacts, hours and exceptions with it when deleted', async () => {
    const { id: branchId } = await newBranch();
    await db.insert(branchContact).values({ branchId, type: 'phone', value: '+639171234567' });
    await db
      .insert(branchHours)
      .values({ branchId, dayOfWeek: 1, opensAt: '08:00', closesAt: '17:00' });
    await db.insert(branchHoursException).values({ branchId, date: '2026-12-25', isClosed: true });

    await db.delete(branch).where(eq(branch.id, branchId));

    for (const table of [branchContact, branchHours, branchHoursException]) {
      const remaining = await db.select().from(table).where(eq(table.branchId, branchId));
      expect(remaining).toEqual([]);
    }
  });
});

describe('branch_contact', () => {
  it('requires E.164 phone and Viber numbers', async () => {
    const { id: branchId } = await newBranch();
    for (const type of ['phone', 'viber'] as const) {
      const local = db.insert(branchContact).values({ branchId, type, value: '09171234567' });
      expect(await violatedConstraint(local)).toBe('branch_contact_phone_e164');
    }
  });

  it('allows several numbers per branch, plus other channels', async () => {
    const { id: branchId } = await newBranch();
    const rows = await db
      .insert(branchContact)
      .values([
        { branchId, type: 'phone', value: '+639171234567', label: 'Globe' },
        { branchId, type: 'phone', value: '+639981234567', label: 'Smart', sortOrder: 1 },
        { branchId, type: 'phone', value: '+63455551234', label: 'Landline', sortOrder: 2 },
        { branchId, type: 'messenger', value: 'https://m.me/testvetclinic' },
        { branchId, type: 'email', value: 'hello@example.com' },
      ])
      .returning();
    expect(rows).toHaveLength(5);
  });
});

describe('branch_hours', () => {
  it('accepts lunch breaks (several intervals a day) and overnight intervals', async () => {
    const { id: branchId } = await newBranch();
    const rows = await db
      .insert(branchHours)
      .values([
        { branchId, dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
        { branchId, dayOfWeek: 1, opensAt: '13:00', closesAt: '17:00' },
        { branchId, dayOfWeek: 5, opensAt: '20:00', closesAt: '02:00' },
      ])
      .returning();
    expect(rows.map((row) => [row.opensAt, row.closesAt])).toEqual([
      ['08:00:00', '12:00:00'],
      ['13:00:00', '17:00:00'],
      ['20:00:00', '02:00:00'],
    ]);
  });

  it('uses ISO weekdays, 1 (Monday) to 7 (Sunday)', async () => {
    const { id: branchId } = await newBranch();
    for (const dayOfWeek of [0, 8]) {
      const query = db
        .insert(branchHours)
        .values({ branchId, dayOfWeek, opensAt: '08:00', closesAt: '17:00' });
      expect(await violatedConstraint(query)).toBe('branch_hours_day_of_week');
    }
  });

  it('rejects intervals that open and close at the same time', async () => {
    const { id: branchId } = await newBranch();
    const query = db
      .insert(branchHours)
      .values({ branchId, dayOfWeek: 1, opensAt: '08:00', closesAt: '08:00' });
    expect(await violatedConstraint(query)).toBe('branch_hours_not_empty');
  });
});

describe('branch_hours_exception', () => {
  it('is either closed or has opening intervals', async () => {
    const { id: branchId } = await newBranch();
    const closedWithHours = db.insert(branchHoursException).values({
      branchId,
      date: '2026-11-01',
      isClosed: true,
      intervals: [{ opensAt: '08:00', closesAt: '12:00' }],
    });
    expect(await violatedConstraint(closedWithHours)).toBe('branch_hours_exception_closed_or_open');

    const openWithoutHours = db
      .insert(branchHoursException)
      .values({ branchId, date: '2026-11-01', isClosed: false });
    expect(await violatedConstraint(openWithoutHours)).toBe(
      'branch_hours_exception_closed_or_open',
    );

    const shortDay = db.insert(branchHoursException).values({
      branchId,
      date: '2026-12-24',
      isClosed: false,
      intervals: [{ opensAt: '08:00', closesAt: '12:00' }],
      note: 'Half day for Christmas Eve',
    });
    await expect(shortDay).resolves.toBeDefined();
  });

  it('allows one exception per branch per date', async () => {
    const { id: branchId } = await newBranch();
    await db.insert(branchHoursException).values({ branchId, date: '2026-12-25', isClosed: true });
    const duplicate = db
      .insert(branchHoursException)
      .values({ branchId, date: '2026-12-25', isClosed: true });
    expect(await violatedConstraint(duplicate)).toBe('branch_hours_exception_branchId_date_unique');
  });

  it('stores intervals as a JSON array', async () => {
    const { id: branchId } = await newBranch();
    const query = db.execute(sql`
      insert into branch_hours_exception (branch_id, date, is_closed, intervals)
      values (${branchId}, '2026-11-02', false, '{"opensAt": "08:00"}')
    `);
    expect(await violatedConstraint(query)).toBe('branch_hours_exception_intervals_array');
  });
});
