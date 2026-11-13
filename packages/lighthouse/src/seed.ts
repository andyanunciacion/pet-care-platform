// The Lighthouse CI fixture (ARCHITECTURE D44). Recreates the `paw_lighthouse` database
// next to DATABASE_URL (a local Postgres only, never your dev data), migrates it, and fills
// it with one complete, made-up clinic: hours, contacts, species, services with prices,
// photos, a logo and products. The images are generated here as PNG files in .images/
// (gitignored); run.ts serves them in place of the photo bucket.
// `pnpm --filter @paw/lighthouse seed` runs only this step.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { createDatabase, databaseUrlFromEnv, runMigrations, schema } from '@paw/db';
import { inArray } from 'drizzle-orm';
import pg from 'pg';

const DATABASE_NAME = 'paw_lighthouse';
/** The page Lighthouse checks. */
export const FIXTURE_PATH = '/pampanga/angeles-city/lighthouse-test-clinic';
/**
 * A second listing for looking at edge cases (not measured): a long name, Messenger only (no
 * phone), no hours, takes emergencies, no photos, a long service name.
 */
export const EDGE_CASE_PATH = '/pampanga/angeles-city/lighthouse-test-edge-cases';
const SLUG = 'lighthouse-test-clinic';
/** Where the fixture's image files go; storage keys are file names in it. */
export const IMAGES_DIR = path.join(import.meta.dirname, '..', '.images');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// PSGC codes from migration 0004: Pampanga, City of Angeles, Balibago.
const PAMPANGA = '0305400000';
const ANGELES = '0330100000';
const BALIBAGO = '0330100003';

// ── Images ──────────────────────────────────────────────────────────────────────────────

/** A seeded pseudo-random generator (mulberry32), so every run draws the same images. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A photo-sized PNG: a diagonal gradient with blotchy noise, so the image optimizer has
 * real work to do (a flat color would shrink to nothing). RGB, 8 bits per channel.
 */
function fakePhoto(width: number, height: number, seed: number): Buffer {
  const next = random(seed);
  const base = [next() * 200, next() * 200, next() * 200];
  const block = 6;
  const cols = Math.ceil(width / block);
  const noise = Array.from({ length: cols * Math.ceil(height / block) }, () => next() * 60 - 30);
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3); // Filter byte 0 (none), then the pixels.
    for (let x = 0; x < width; x++) {
      const shade = ((x / width + y / height) / 2) * 90;
      const jitter = noise[Math.floor(y / block) * cols + Math.floor(x / block)] ?? 0;
      for (let c = 0; c < 3; c++) {
        const value = (base[c] ?? 0) + shade + jitter;
        row[1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(value)));
      }
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // Bit depth
  header[9] = 2; // Color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

interface FixtureImage {
  storageKey: string;
  alt: string;
  width: number;
  height: number;
}

async function writeImage(
  name: string,
  alt: string,
  width: number,
  height: number,
  seed: number,
): Promise<FixtureImage> {
  const storageKey = `${name}.png`;
  await writeFile(path.join(IMAGES_DIR, storageKey), fakePhoto(width, height, seed));
  return { storageKey, alt, width, height };
}

// ── Database ────────────────────────────────────────────────────────────────────────────

async function recreateDatabase(adminUrl: string): Promise<string> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const name = pg.escapeIdentifier(DATABASE_NAME);
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }
  const url = new URL(adminUrl);
  url.pathname = `/${DATABASE_NAME}`;
  await runMigrations(url.toString());
  return url.toString();
}

async function seed(databaseUrl: string): Promise<void> {
  const database = createDatabase({ connectionString: databaseUrl });
  const { db } = database;
  try {
    const [business] = await db
      .insert(schema.business)
      .values({
        name: 'Lighthouse Test Animal Clinic',
        slug: SLUG,
        type: 'vet_clinic',
        listingStatus: 'published',
        description:
          'A made-up clinic for performance tests. Consultations, vaccinations, kapon and ' +
          'laboratory tests for dogs and cats, with a small pet supplies corner.',
      })
      .returning();
    if (business === undefined) throw new Error('no business');

    const [branch] = await db
      .insert(schema.branch)
      .values({
        businessId: business.id,
        name: 'Main',
        slug: 'main',
        addressLine: '123 Fixture Street',
        provinceCode: PAMPANGA,
        cityCode: ANGELES,
        barangayCode: BALIBAGO,
        location: { lng: 120.5887, lat: 15.145 },
        listingStatus: 'published',
        acceptsEmergencies: true,
        hoursConfirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        hoursConfirmedBy: 'paw_ops',
      })
      .returning();
    if (branch === undefined) throw new Error('no branch');

    // Mon–Sat with a lunch break, Sunday mornings.
    await db.insert(schema.branchHours).values([
      ...[1, 2, 3, 4, 5, 6].flatMap((dayOfWeek) => [
        { branchId: branch.id, dayOfWeek, opensAt: '08:00', closesAt: '12:00' },
        { branchId: branch.id, dayOfWeek, opensAt: '13:00', closesAt: '18:00' },
      ]),
      { branchId: branch.id, dayOfWeek: 7, opensAt: '09:00', closesAt: '12:00' },
    ]);

    await db.insert(schema.branchContact).values([
      { branchId: branch.id, type: 'phone', value: '+639171234567', sortOrder: 0 },
      {
        branchId: branch.id,
        type: 'phone',
        value: '+63455551234',
        label: 'Landline',
        sortOrder: 1,
      },
      {
        branchId: branch.id,
        type: 'messenger',
        value: 'https://m.me/lighthouse.test.clinic',
        sortOrder: 2,
      },
      { branchId: branch.id, type: 'viber', value: '+639171234567', sortOrder: 3 },
    ]);

    const species = await db
      .select()
      .from(schema.species)
      .where(inArray(schema.species.code, ['dog', 'cat', 'rabbit']));
    await db
      .insert(schema.branchSpecies)
      .values(species.map((row) => ({ branchId: branch.id, speciesId: row.id })));

    const categories = new Map(
      (await db.select().from(schema.serviceCategory)).map((row) => [row.code, row.id]),
    );
    const category = (code: string) => {
      const id = categories.get(code);
      if (id === undefined) throw new Error(`no category ${code} (migrations not applied?)`);
      return id;
    };
    await db.insert(schema.branchService).values(
      [
        { name: 'Consultation', categoryId: category('consultation'), priceMin: 50000 },
        { name: 'Anti-rabies vaccine', categoryId: category('vaccination'), priceMin: 35000 },
        {
          name: '5-in-1 vaccine',
          categoryId: category('vaccination'),
          priceMin: 65000,
          priceMax: 85000,
        },
        { name: 'Deworming', categoryId: category('deworming'), priceMin: 20000 },
        {
          name: 'Kapon (cat)',
          categoryId: category('spay_neuter'),
          priceMin: 150000,
          priceMax: 250000,
          priceNote: 'Includes take-home meds.',
        },
        { name: 'Kapon (dog)', categoryId: category('spay_neuter'), priceMin: 250000 },
        { name: 'Complete blood count', categoryId: category('laboratory'), priceMin: 60000 },
        {
          name: 'Confinement',
          categoryId: category('confinement'),
          priceMin: 80000,
          priceUnit: 'per_night' as const,
        },
        { name: 'Grooming', categoryId: category('grooming'), priceMin: null },
      ].map((service) => ({ branchId: branch.id, ...service })),
    );

    const products = await db
      .insert(schema.product)
      .values(
        [
          { name: 'Adult dog food, 2 kg', category: 'Food', price: 125000 },
          {
            name: 'Kitten food, 1 kg',
            category: 'Food',
            price: 68000,
            availability: 'limited' as const,
          },
          { name: 'Flea and tick collar', category: 'Accessories', price: 45000 },
          { name: 'Pet shampoo', category: null, price: null, availability: 'out' as const },
        ].map((row) => ({ businessId: business.id, ...row })),
      )
      .returning();

    await rm(IMAGES_DIR, { recursive: true, force: true });
    await mkdir(IMAGES_DIR, { recursive: true });
    const photoAlts = [
      'The clinic from the street',
      'Reception desk',
      'Waiting area with benches',
      'Examination room',
      'Pet supplies shelf',
      'Recovery cages',
    ];
    const photos = await Promise.all(
      photoAlts.map((alt, i) => writeImage(`photo-${String(i + 1)}`, alt, 1600, 1200, i + 1)),
    );
    const logo = await writeImage('logo', 'Clinic logo', 512, 512, 100);
    const productImages = await Promise.all(
      products
        .slice(0, 3)
        .map((row, i) => writeImage(`product-${String(i + 1)}`, row.name, 1200, 1200, 200 + i)),
    );

    await db.insert(schema.media).values([
      { kind: 'logo', businessId: business.id, ...logo },
      ...photos.map((photo, sortOrder) => ({
        kind: 'photo' as const,
        branchId: branch.id,
        sortOrder,
        ...photo,
      })),
      ...productImages.map((image, i) => ({
        kind: 'photo' as const,
        productId: products[i]?.id,
        ...image,
      })),
    ]);

    await seedEdgeCases(db, category);
  } finally {
    await database.close();
  }
}

async function seedEdgeCases(
  db: ReturnType<typeof createDatabase>['db'],
  category: (code: string) => string,
): Promise<void> {
  const [business] = await db
    .insert(schema.business)
    .values({
      name: 'Lighthouse Test Veterinary Clinic and Pet Wellness Center of Balibago',
      slug: 'lighthouse-test-edge-cases',
      type: 'vet_clinic',
      listingStatus: 'published',
    })
    .returning();
  if (business === undefined) throw new Error('no business');
  const [branch] = await db
    .insert(schema.branch)
    .values({
      businessId: business.id,
      name: 'Main',
      slug: 'main',
      addressLine: '45 Edge Case Avenue',
      provinceCode: PAMPANGA,
      cityCode: ANGELES,
      barangayCode: BALIBAGO,
      location: { lng: 120.59, lat: 15.16 },
      listingStatus: 'published',
      acceptsEmergencies: true,
    })
    .returning();
  if (branch === undefined) throw new Error('no branch');
  await db.insert(schema.branchContact).values({
    branchId: branch.id,
    type: 'messenger',
    value: 'https://m.me/lighthouse.test.edge',
  });
  await db.insert(schema.branchService).values([
    {
      branchId: branch.id,
      name: 'Complete vaccination package with deworming, health certificate and follow-up visit',
      categoryId: category('vaccination'),
      priceMin: 150000,
      priceMax: 280000,
      priceUnit: 'per_session' as const,
    },
    { branchId: branch.id, name: 'Consultation', categoryId: category('consultation') },
  ]);
}

// ── Main ────────────────────────────────────────────────────────────────────────────────

/** Recreates and fills the fixture database; returns its URL. */
export async function seedFixture(adminUrl: string): Promise<string> {
  if (!LOCAL_HOSTS.has(new URL(adminUrl).hostname)) {
    throw new Error('Refusing to run: DATABASE_URL must point at a local Postgres (localhost).');
  }
  const url = await recreateDatabase(adminUrl);
  await seed(url);
  return url;
}

if (import.meta.main) {
  try {
    await seedFixture(databaseUrlFromEnv());
    console.log(`Seeded ${DATABASE_NAME}: ${FIXTURE_PATH}, images in ${IMAGES_DIR}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
