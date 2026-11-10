import { randomBytes, randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDatabase, schema } from '@paw/db';
import {
  insertTestAreas,
  insertTestBranch,
  insertTestBusiness,
  insertTestCategory,
  insertTestSpecies,
  insertTestUser,
  testArea,
  testDatabaseUrl,
} from '@paw/db/testing';
import { addDays, normalizePhPhone, slugify, toManila } from '@paw/domain';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.ts';
import { IMPORT_COLUMNS, type ImportResult } from '../../services/imports.ts';
import { sessionCookie, testEnv } from '../../testing.ts';

let app: Awaited<ReturnType<typeof buildApp>>;
let cookie: string;
let adminId: string;
const database = createDatabase({ connectionString: testDatabaseUrl() });
const { db } = database;

// Made-up taxonomy (never the real reference data), referred to by its unique codes.
let dog: Awaited<ReturnType<typeof insertTestSpecies>>;
let cat: Awaited<ReturnType<typeof insertTestSpecies>>;
let group: Awaited<ReturnType<typeof insertTestCategory>>;
let vaccination: Awaited<ReturnType<typeof insertTestCategory>>;
let neuter: Awaited<ReturnType<typeof insertTestCategory>>;
let neuterSynonym: string;

beforeAll(async () => {
  app = await buildApp({ env: testEnv() });
  await insertTestAreas(db);
  const admin = await insertTestUser(db, { platformRole: 'super_admin' });
  adminId = admin.id;
  cookie = await sessionCookie(app, admin.id);

  dog = await insertTestSpecies(db, { name: 'Import test dog', sortOrder: 1 });
  cat = await insertTestSpecies(db, { name: 'Import test cat', sortOrder: 2 });
  group = await insertTestCategory(db, { name: 'Import test group' });
  vaccination = await insertTestCategory(db, { name: 'Import vaccination', parentId: group.id });
  neuterSynonym = `kpn${randomBytes(4).toString('hex')}`;
  neuter = await insertTestCategory(db, {
    name: 'Import neuter',
    parentId: group.id,
    synonyms: [neuterSynonym],
  });
});

afterAll(async () => {
  await app.close();
  await database.close();
});

// ── Building CSV files ──────────────────────────────────────────────────────────────────

const HEADER = [
  'Business',
  'Branch',
  'Data source',
  'Address',
  'Barangay',
  'City',
  'Province',
  'Coordinates',
  'Phones',
  'Viber',
  'Messenger',
  'Email',
  'Accepts emergencies',
  'Open 24h',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
  'Species',
  'Services',
  'Confirmed on',
] as const;

type Row = Partial<Record<string, string>>;

const hex = () => randomBytes(4).toString('hex');
/** A made-up clinic name, unlike other tests' "Test Vet Clinic". */
const clinicName = () => `Zq${hex()} Animal Care`;
/** Somewhere in Mindanao, far from the Angeles pins other tests use, and from each other. */
const coordinates = () =>
  `${(7 + randomInt(0, 1_000_000) / 1_000_000).toFixed(6)}, ${(124 + randomInt(0, 1_000_000) / 1_000_000).toFixed(6)}`;
const phone = () => `0917 ${String(randomInt(100, 1000))} ${String(randomInt(1000, 10_000))}`;

const LUNCH_BREAK = '8am-12nn, 1pm-5pm';

function validRow(overrides: Row = {}): Row {
  return {
    business: clinicName(),
    data_source: 'Called the clinic',
    address: '1 Import Street',
    barangay: 'Brgy. Test Barangay',
    city: 'Test City',
    province: 'Test Province',
    coordinates: coordinates(),
    phones: phone(),
    mon: LUNCH_BREAK,
    tue: LUNCH_BREAK,
    wed: LUNCH_BREAK,
    thu: LUNCH_BREAK,
    fri: LUNCH_BREAK,
    sat: '8am-12nn',
    sun: 'closed',
    species: `${dog.code}; ${cat.name}`,
    services: `${vaccination.code}, ${neuterSynonym}`,
    ...overrides,
  };
}

const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
const keyOf = (header: string) => header.toLowerCase().replace(/\s+/g, '_');

function csvOf(rows: readonly Row[], header: readonly string[] = HEADER): string {
  const lines = [header.map(cell).join(',')];
  for (const row of rows) lines.push(header.map((h) => cell(row[keyOf(h)] ?? '')).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

async function runImport(csv: string, dryRun: boolean, importAnyway: string[] = []) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/admin/imports',
    headers: { cookie },
    payload: { csv, dryRun, importAnyway },
  });
  return response;
}

async function imported(csv: string, dryRun: boolean, importAnyway: string[] = []) {
  const response = await runImport(csv, dryRun, importAnyway);
  expect(response.statusCode).toBe(200);
  return response.json<ImportResult>();
}

const businessesNamed = (name: string) =>
  db.select().from(schema.business).where(eq(schema.business.name, name));

const today = () => toManila(new Date()).date;

// ── Tests ───────────────────────────────────────────────────────────────────────────────

describe('POST /v1/admin/imports: a clean file', () => {
  it('a dry run reports the business as new and writes nothing', async () => {
    const row = validRow();
    const result = await imported(csvOf([row]), true);

    expect(result.fileErrors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.businesses).toEqual([
      {
        key: row.business?.toLowerCase(),
        name: row.business,
        status: 'new',
        businessId: null,
        errors: [],
        duplicates: [],
        rows: [{ row: 2, branch: 'Test City', city: 'Test City', errors: [] }],
      },
    ]);
    expect(await businessesNamed(row.business ?? '')).toEqual([]);
  });

  it('imports the business hidden, with its branch, contacts, hours, species and services', async () => {
    // Numbers no other test uses (a shared one would make this a duplicate).
    const [mobile, viber] = [phone(), phone()];
    const landline = `(045) ${String(randomInt(100, 1000))} ${String(randomInt(1000, 10_000))}`;
    const row = validRow({
      branch: 'Balibago',
      phones: `${mobile} / ${landline}`,
      viber,
      messenger: 'm.me/zqclinic',
      email: 'hello@example.test',
      accepts_emergencies: 'yes',
    });
    const result = await imported(csvOf([row]), false);

    const [entry] = result.businesses;
    expect(entry?.status).toBe('imported');
    const [created] = await businessesNamed(row.business ?? '');
    expect(created).toMatchObject({
      id: entry?.businessId,
      slug: slugify(row.business ?? ''),
      type: 'vet_clinic',
      listingStatus: 'hidden',
      claimStatus: 'unclaimed',
      dataSource: 'Called the clinic',
    });

    const [b] = await db
      .select()
      .from(schema.branch)
      .where(eq(schema.branch.businessId, created?.id ?? ''));
    expect(b).toMatchObject({
      name: 'Balibago',
      slug: 'balibago',
      addressLine: '1 Import Street',
      provinceCode: testArea.province,
      cityCode: testArea.city,
      barangayCode: testArea.barangay,
      is24h: false,
      acceptsEmergencies: true,
      listingStatus: 'published',
      hoursConfirmedAt: null,
      hoursConfirmedBy: null,
    });
    const branchId = b?.id ?? '';

    const contacts = await db
      .select({ type: schema.branchContact.type, value: schema.branchContact.value })
      .from(schema.branchContact)
      .where(eq(schema.branchContact.branchId, branchId))
      .orderBy(asc(schema.branchContact.sortOrder));
    expect(contacts).toEqual([
      { type: 'phone', value: normalizePhPhone(mobile) },
      { type: 'phone', value: normalizePhPhone(landline) },
      { type: 'viber', value: normalizePhPhone(viber) },
      { type: 'messenger', value: 'https://m.me/zqclinic' },
      { type: 'email', value: 'hello@example.test' },
    ]);

    const hours = await db
      .select()
      .from(schema.branchHours)
      .where(eq(schema.branchHours.branchId, branchId));
    // Monday to Friday with a lunch break, Saturday mornings, Sunday closed.
    expect(hours).toHaveLength(11);
    expect(hours.filter((h) => h.dayOfWeek === 6)).toMatchObject([
      { opensAt: '08:00:00', closesAt: '12:00:00' },
    ]);
    expect(hours.some((h) => h.dayOfWeek === 7)).toBe(false);

    const treated = await db
      .select({ speciesId: schema.branchSpecies.speciesId })
      .from(schema.branchSpecies)
      .where(eq(schema.branchSpecies.branchId, branchId));
    expect(treated.map((t) => t.speciesId).sort()).toEqual([dog.id, cat.id].sort());

    const services = await db
      .select()
      .from(schema.branchService)
      .where(eq(schema.branchService.branchId, branchId))
      .orderBy(asc(schema.branchService.sortOrder));
    expect(services).toMatchObject([
      { categoryId: vaccination.id, name: 'Import vaccination', priceMin: null, priceMax: null },
      { categoryId: neuter.id, name: 'Import neuter', priceMin: null, priceMax: null },
    ]);

    const audit = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.actorId, adminId));
    const businessEntry = audit.find((e) => e.entityId === created?.id);
    expect(businessEntry).toMatchObject({ action: 'business.import', entityType: 'business' });
    expect(businessEntry?.diff).toMatchObject({
      dataSource: { from: null, to: 'Called the clinic' },
    });
    const branchEntry = audit.find((e) => e.entityId === branchId);
    expect(branchEntry).toMatchObject({ action: 'branch.import', entityType: 'branch' });
    expect(branchEntry?.diff).toMatchObject({
      name: { from: null, to: 'Balibago' },
      speciesTreated: { from: null, to: ['Import test dog', 'Import test cat'] },
      services: { from: null, to: ['Import vaccination', 'Import neuter'] },
    });
    expect(branchEntry?.diff).not.toHaveProperty('hoursConfirmedAt');
  });

  it('records confirmed_on as an hours confirmation by PAW, at the start of that day in Manila', async () => {
    const row = validRow({ confirmed_on: '2026-01-15' });
    await imported(csvOf([row]), false);

    const [created] = await businessesNamed(row.business ?? '');
    const [b] = await db
      .select()
      .from(schema.branch)
      .where(eq(schema.branch.businessId, created?.id ?? ''));
    expect(b?.hoursConfirmedAt?.toISOString()).toBe('2026-01-14T16:00:00.000Z');
    expect(b?.hoursConfirmedBy).toBe('paw_ops');
  });

  it('imports a 24-hour branch, and one with unknown hours', async () => {
    const days = { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' };
    const allDay = validRow({ ...days, open_24h: 'Yes', confirmed_on: today() });
    const unknown = validRow(days);
    const result = await imported(csvOf([allDay, unknown]), false);
    expect(result.businesses.map((b) => b.status)).toEqual(['imported', 'imported']);

    const [first] = await businessesNamed(allDay.business ?? '');
    const [b] = await db
      .select()
      .from(schema.branch)
      .where(eq(schema.branch.businessId, first?.id ?? ''));
    expect(b?.is24h).toBe(true);
    expect(b?.hoursConfirmedBy).toBe('paw_ops');
  });

  it('groups rows with the same business name (any case) into one business', async () => {
    const name = clinicName();
    const result = await imported(
      csvOf([
        validRow({ business: name, branch: 'Main' }),
        validRow({ business: ` ${name.toUpperCase()} `, branch: 'Annex', data_source: '' }),
      ]),
      false,
    );

    expect(result.businesses).toHaveLength(1);
    expect(result.businesses[0]?.rows.map((r) => [r.row, r.branch])).toEqual([
      [2, 'Main'],
      [3, 'Annex'],
    ]);
    const [created] = await businessesNamed(name);
    const branches = await db
      .select({ name: schema.branch.name })
      .from(schema.branch)
      .where(eq(schema.branch.businessId, created?.id ?? ''))
      .orderBy(asc(schema.branch.name));
    expect(branches.map((b) => b.name)).toEqual(['Annex', 'Main']);
  });

  it('adds -2 to a slug that is taken', async () => {
    const name = clinicName();
    await insertTestBusiness(db, { name: 'Someone else', slug: slugify(name) });
    await imported(csvOf([validRow({ business: name })]), false);

    const [created] = await businessesNamed(name);
    expect(created?.slug).toBe(`${slugify(name)}-2`);
  });
});

describe('POST /v1/admin/imports: row errors', () => {
  const future = () => addDays(today(), 2);
  const noHours = { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' };

  it.each<[string, () => Row, string, string]>([
    ['a missing business name', () => ({ business: '' }), 'business', 'Enter the business name'],
    ['a blank address', () => ({ address: '' }), 'address', 'Required'],
    ['an unknown province', () => ({ province: 'Atlantis' }), 'province', 'No province named'],
    ['an unknown city', () => ({ city: 'Nowhere' }), 'city', 'No city or municipality named'],
    [
      'a barangay in another city',
      () => ({ barangay: 'Other Test Barangay' }),
      'barangay',
      'No barangay named',
    ],
    [
      'unreadable coordinates',
      () => ({ coordinates: 'near the church' }),
      'coordinates',
      'lat, lng',
    ],
    [
      'swapped coordinates',
      () => ({ coordinates: '124.5, 7.5' }),
      'coordinates',
      'Latitude comes first',
    ],
    [
      'coordinates outside the Philippines',
      () => ({ coordinates: '-33.8688, 151.2093' }),
      'coordinates',
      'must be in the Philippines',
    ],
    ['a bad phone number', () => ({ phones: '12345' }), 'phones', 'Philippine number'],
    ['a bad email', () => ({ email: 'not an email' }), 'email', 'not an email'],
    ['a yes/no typo', () => ({ accepts_emergencies: 'maybe' }), 'accepts_emergencies', 'yes or no'],
    ['a missing day', () => ({ tue: '' }), 'tue', 'Write the hours or "closed"'],
    ['unreadable hours', () => ({ wed: 'by appointment' }), 'wed', "Can't read"],
    ['ambiguous hours', () => ({ thu: '8-5' }), 'thu', 'morning or afternoon'],
    ['overlapping hours', () => ({ fri: '8am-5pm, 9am-10am' }), 'fri', 'Overlaps'],
    ['"24 hours" in a day', () => ({ mon: '24 hours' }), 'mon', 'open_24h'],
    ['day hours on a 24-hour branch', () => ({ open_24h: 'yes' }), 'open_24h', 'leave mon to sun'],
    ['an unknown species', () => ({ species: 'unicorn' }), 'species', 'Unknown species'],
    ['an unknown service', () => ({ services: 'aromatherapy' }), 'services', 'Unknown service'],
    ['a service group', () => ({ services: group.code }), 'services', 'is a group'],
    [
      'a date that is not YYYY-MM-DD',
      () => ({ confirmed_on: '11/10/2026' }),
      'confirmed_on',
      'YYYY-MM-DD',
    ],
    ['a future confirmation', () => ({ confirmed_on: future() }), 'confirmed_on', 'in the future'],
    [
      'a confirmation without hours',
      () => ({ ...noHours, confirmed_on: today() }),
      'confirmed_on',
      'no hours to confirm',
    ],
  ])('flags %s', async (_label, overrides, column, message) => {
    const row = validRow(overrides());
    const result = await imported(csvOf([row]), true);

    const [entry] = result.businesses;
    expect(entry?.status).toBe('invalid');
    expect(entry?.rows[0]?.errors).toContainEqual({
      column,
      message: expect.stringContaining(message) as string,
    });
  });

  it('flags two branches of one business with the same name', async () => {
    const name = clinicName();
    const result = await imported(
      csvOf([
        validRow({ business: name, branch: 'Main' }),
        validRow({ business: name, branch: 'main' }),
      ]),
      true,
    );
    expect(result.businesses[0]?.rows[1]?.errors).toContainEqual({
      column: 'branch',
      message: expect.stringContaining('same branch name') as string,
    });
  });

  it('flags a business without a data source, or with two', async () => {
    const name = clinicName();
    const result = await imported(
      csvOf([
        validRow({ data_source: '' }),
        validRow({ business: name, data_source: 'Facebook page' }),
        validRow({ business: name, data_source: 'Clinic visit' }),
      ]),
      true,
    );
    const [missing, conflicting] = result.businesses;
    expect(missing?.status).toBe('invalid');
    expect(missing?.errors).toEqual([
      { column: 'data_source', message: expect.stringContaining('Say where') as string },
    ]);
    expect(conflicting?.errors).toEqual([
      {
        column: 'data_source',
        message: expect.stringContaining('different data sources') as string,
      },
    ]);
  });

  it('imports the clean businesses and skips invalid ones', async () => {
    const good = validRow();
    const bad = validRow({ city: 'Nowhere' });
    const result = await imported(csvOf([good, bad]), false);

    expect(result.businesses.map((b) => b.status)).toEqual(['imported', 'invalid']);
    expect(await businessesNamed(good.business ?? '')).toHaveLength(1);
    expect(await businessesNamed(bad.business ?? '')).toEqual([]);
  });
});

describe('POST /v1/admin/imports: file errors', () => {
  it('reports missing required columns and imports nothing', async () => {
    const header = HEADER.filter((h) => h !== 'Coordinates' && h !== 'Data source');
    const result = await imported(csvOf([validRow()], header), false);
    expect(result.fileErrors).toEqual(['Missing required columns: data_source, coordinates.']);
    expect(result.businesses).toEqual([]);
  });

  it('warns about columns it ignores', async () => {
    const row = { ...validRow(), notes: 'Owner is Dr. Cruz' };
    const result = await imported(csvOf([row], [...HEADER, 'Notes']), true);
    expect(result.warnings).toEqual([
      "These columns aren't part of the import format and were ignored: Notes.",
    ]);
    expect(result.businesses[0]?.status).toBe('new');
  });

  it('reads a file with a byte order mark (Excel) and skips blank rows', async () => {
    const csv = csvOf([validRow(), {}, validRow()]);
    const result = await imported(`\uFEFF${csv}`, true);
    expect(result.fileErrors).toEqual([]);
    expect(result.businesses.flatMap((b) => b.rows.map((r) => r.row))).toEqual([2, 4]);
  });

  it('reports a file with no rows, an unreadable file and too many rows', async () => {
    expect((await imported(csvOf([]), true)).fileErrors).toEqual([
      'The file has no rows below the header.',
    ]);
    const broken = await imported(`${HEADER.join(',')}\n"unclosed,quote`, true);
    expect(broken.fileErrors[0]).toContain("This isn't a readable CSV file");

    const many = Array.from({ length: 1001 }, () => ({ business: 'X' }));
    expect((await imported(csvOf(many), true)).fileErrors).toEqual([
      'The file has 1001 rows; the limit is 1000. Split it into smaller files.',
    ]);
  });

  it('400 for a file over 500 KB', async () => {
    const response = await runImport('x'.repeat(500_001), true);
    expect(response.statusCode).toBe(400);
  });
});

describe('POST /v1/admin/imports: duplicates', () => {
  it('flags a phone an existing branch already has, and imports it only when asked', async () => {
    const existing = await insertTestBusiness(db, { name: 'Existing listing' });
    const existingBranch = await insertTestBranch(db, existing.id, { name: 'Downtown' });
    const number = phone();
    await db.insert(schema.branchContact).values({
      branchId: existingBranch.id,
      type: 'phone',
      value: normalizePhPhone(number) ?? '',
    });

    const row = validRow({ viber: number });
    const csv = csvOf([row]);
    const dry = await imported(csv, true);
    const [entry] = dry.businesses;
    expect(entry?.status).toBe('duplicate');
    expect(entry?.duplicates).toEqual([
      {
        reason: 'phone',
        businessId: existing.id,
        businessName: 'Existing listing',
        branchName: 'Downtown',
        row: null,
        distanceMeters: null,
        phone: normalizePhPhone(number),
      },
    ]);

    expect((await imported(csv, false)).businesses[0]?.status).toBe('skipped');
    expect(await businessesNamed(row.business ?? '')).toEqual([]);

    const forced = await imported(csv, false, [entry?.key ?? '']);
    expect(forced.businesses[0]?.status).toBe('imported');
    expect(await businessesNamed(row.business ?? '')).toHaveLength(1);
  });

  it('flags a similar business name within 250 m', async () => {
    const name = clinicName();
    const existing = await insertTestBusiness(db, { name });
    await insertTestBranch(db, existing.id, { name: 'Main', location: { lng: 124.5, lat: 7.5 } });

    // About 110 m north, spelled a little differently.
    const near = await imported(
      csvOf([validRow({ business: `${name} Center`, coordinates: '7.501, 124.5' })]),
      true,
    );
    expect(near.businesses[0]?.duplicates).toEqual([
      {
        reason: 'name_nearby',
        businessId: existing.id,
        businessName: name,
        branchName: 'Main',
        row: null,
        distanceMeters: expect.closeTo(111, -1) as number,
        phone: null,
      },
    ]);

    // The same name 2 km away is a different place.
    const far = await imported(
      csvOf([validRow({ business: name, coordinates: '7.518, 124.5' })]),
      true,
    );
    expect(far.businesses[0]?.status).toBe('new');
  });

  it('flags two businesses in the same file that share a number', async () => {
    const number = phone();
    const first = validRow({ phones: number });
    const second = validRow({ phones: `0999 000 0000; ${number}` });
    const result = await imported(csvOf([first, second]), true);

    expect(result.businesses.map((b) => b.status)).toEqual(['duplicate', 'duplicate']);
    expect(result.businesses[0]?.duplicates).toMatchObject([
      { reason: 'phone', businessId: null, businessName: second.business, row: 3 },
    ]);
    expect(result.businesses[1]?.duplicates).toMatchObject([
      { reason: 'phone', businessId: null, businessName: first.business, row: 2 },
    ]);
  });

  it('flags everything as a duplicate when the same file is imported again', async () => {
    const csv = csvOf([validRow(), validRow({ phones: '' })]);
    expect((await imported(csv, false)).businesses.map((b) => b.status)).toEqual([
      'imported',
      'imported',
    ]);
    const again = await imported(csv, true);
    expect(again.businesses.map((b) => b.status)).toEqual(['duplicate', 'duplicate']);
    // The one without phones is caught by its name and location.
    expect(again.businesses[1]?.duplicates.map((d) => [d.reason, d.distanceMeters])).toEqual([
      ['name_nearby', 0],
    ]);
  });
});

describe('the template in the admin', () => {
  it('has every column and a valid example row (with the real Pampanga areas and taxonomy)', async () => {
    const template = await readFile(
      new URL('../../../../web/public/templates/paw-listings-template.csv', import.meta.url),
      'utf8',
    );
    const header = template.split(/\r?\n/)[0]?.split(',') ?? [];
    expect([...header].sort()).toEqual([...IMPORT_COLUMNS].sort());

    const result = await imported(template, true);
    expect(result.fileErrors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(
      result.businesses.flatMap((b) => [...b.errors, ...b.rows.flatMap((r) => r.errors)]),
    ).toEqual([]);
  });
});

describe('POST /v1/admin/imports: who can call it', () => {
  it('401 without a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/imports',
      payload: { csv: 'business', dryRun: true },
    });
    expect(response.statusCode).toBe(401);
  });
});
