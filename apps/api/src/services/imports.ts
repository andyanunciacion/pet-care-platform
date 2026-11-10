// CSV import of listings for PAW ops (P1-2e, ARCHITECTURE D39; the format is documented in
// AI_DOCS/csv-import.md). One row per branch; rows with the same business name become one
// business. A dry run reports every row's problems and likely duplicates; the confirm runs
// the same checks again and writes the businesses that passed, each with its branches.
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import {
  normalizePhPhone,
  parseDayHours,
  parseLatLng,
  slugify,
  toManila,
  type DayHoursTextIssue,
  type WeeklyInterval,
} from '@paw/domain';
import { CsvError, parse } from 'csv-parse/sync';
import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { diffFields, recordAudit, type Tx } from '../audit.ts';
import { isUniqueViolation } from '../db-errors.ts';
import { httpError } from '../errors.ts';
import { ReplaceHoursSchema } from './branch-hours.ts';
import {
  auditContacts,
  BRANCH_AUDITED_FIELDS,
  CreateBranchSchema,
  replaceContacts,
  type CreateBranchInput,
} from './branches.ts';
import { BUSINESS_AUDITED_FIELDS, CreateBusinessSchema } from './businesses.ts';

const {
  business,
  branch,
  branchContact,
  branchHours,
  branchService,
  branchSpecies,
  psgcArea,
  serviceCategory,
  species,
} = schema;

// ── Limits and the column list ──────────────────────────────────────────────────────────

/** Far more than the launch area's clinics; keeps one request (and its transaction) small. */
export const MAX_IMPORT_ROWS = 1000;
/** Characters. Stays under the 1 MB request limits of Fastify and Next's Server Actions. */
export const MAX_IMPORT_CSV_LENGTH = 500_000;
/** An existing branch this close, with a similar business name, is a likely duplicate. */
export const DUPLICATE_RADIUS_METERS = 250;
/** pg_trgm similarity (0–1) between business names that counts as "similar". */
export const DUPLICATE_NAME_SIMILARITY = 0.3;

/** ISO weekday order: index + 1 is the day of week. */
const DAY_COLUMNS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const REQUIRED_COLUMNS = [
  'business',
  'data_source',
  'address',
  'province',
  'city',
  'coordinates',
] as const;
export const IMPORT_COLUMNS = [
  ...REQUIRED_COLUMNS,
  'branch',
  'barangay',
  'phones',
  'viber',
  'messenger',
  'email',
  'accepts_emergencies',
  'open_24h',
  ...DAY_COLUMNS,
  'species',
  'services',
  'confirmed_on',
] as const;

type Column = (typeof IMPORT_COLUMNS)[number];

const isColumn = (key: string): key is Column =>
  (IMPORT_COLUMNS as readonly string[]).includes(key);

// ── Input and response schemas ──────────────────────────────────────────────────────────

export const ImportCsvSchema = z.object({
  /** The file's text, as the browser read it. */
  csv: z
    .string()
    .min(1, 'The file is empty.')
    .max(
      MAX_IMPORT_CSV_LENGTH,
      `The file is over ${String(MAX_IMPORT_CSV_LENGTH / 1000)} KB. Split it into smaller files.`,
    ),
  /** true: only check and report. false: import what passes. */
  dryRun: z.boolean(),
  /** Keys of businesses flagged as likely duplicates that should be imported anyway. */
  importAnyway: z.array(z.string().max(300)).max(MAX_IMPORT_ROWS).default([]),
});

const CellErrorSchema = z.object({
  /** The CSV column to blame, or null for the row (or business) as a whole. */
  column: z.string().nullable(),
  message: z.string(),
});

const DuplicateSchema = z.object({
  reason: z.enum(['phone', 'name_nearby']),
  /** The existing listing, or null when the match is another business in the same file. */
  businessId: z.uuid().nullable(),
  businessName: z.string(),
  branchName: z.string(),
  /** The other business's row in this file (null for an existing listing). */
  row: z.int().nullable(),
  /** name_nearby only. */
  distanceMeters: z.int().nullable(),
  /** phone only, in E.164. */
  phone: z.string().nullable(),
});

export const IMPORT_STATUSES = ['new', 'duplicate', 'invalid', 'imported', 'skipped'] as const;

export const ImportResultSchema = z.object({
  dryRun: z.boolean(),
  /** Problems with the file as a whole (nothing is checked further, or imported). */
  fileErrors: z.array(z.string()),
  /** e.g. columns that aren't part of the format and were ignored. */
  warnings: z.array(z.string()),
  /** In the order they first appear in the file. */
  businesses: z.array(
    z.object({
      /** Identifies the business across a dry run and its confirm (see importAnyway). */
      key: z.string(),
      name: z.string(),
      /**
       * Dry run: new, duplicate or invalid. Confirm: imported, skipped (a duplicate not in
       * importAnyway) or invalid.
       */
      status: z.enum(IMPORT_STATUSES),
      /** Set once imported. */
      businessId: z.uuid().nullable(),
      /** Problems with the business as a whole, e.g. two different data sources. */
      errors: z.array(CellErrorSchema),
      duplicates: z.array(DuplicateSchema),
      rows: z.array(
        z.object({
          /** The spreadsheet row number (the header is row 1). */
          row: z.int(),
          branch: z.string(),
          city: z.string(),
          errors: z.array(CellErrorSchema),
        }),
      ),
    }),
  ),
});

type ImportCsvInput = z.infer<typeof ImportCsvSchema>;
export type ImportResult = z.infer<typeof ImportResultSchema>;
type CellError = z.infer<typeof CellErrorSchema>;
type Duplicate = z.infer<typeof DuplicateSchema>;
type ImportStatus = (typeof IMPORT_STATUSES)[number];

// ── Reading the file ────────────────────────────────────────────────────────────────────

type Cells = Record<Column, string>;

interface SheetRow {
  row: number;
  cells: Cells;
  /** Cells to the right of the last header column that aren't empty. */
  overflow: boolean;
}

interface Sheet {
  rows: SheetRow[];
  fileErrors: string[];
  warnings: string[];
}

/** "Confirmed on" → "confirmed_on", "Open 24h" → "open_24h". */
const headerKey = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

function readSheet(csv: string): Sheet {
  let records: string[][];
  try {
    // bom: Excel starts UTF-8 files with a byte order mark. relax_column_count: rows may be
    // shorter than the header (missing trailing cells are blank).
    records = parse(csv, { bom: true, relax_column_count: true });
  } catch (error) {
    if (error instanceof CsvError) {
      return {
        rows: [],
        fileErrors: [`This isn't a readable CSV file: ${error.message}`],
        warnings: [],
      };
    }
    throw error;
  }

  const [header, ...data] = records;
  if (header === undefined) return { rows: [], fileErrors: ['The file is empty.'], warnings: [] };

  const fileErrors: string[] = [];
  const index = new Map<Column, number>();
  const ignored: string[] = [];
  header.forEach((text, i) => {
    const key = headerKey(text);
    if (key === '') return;
    if (!isColumn(key)) {
      ignored.push(text.trim());
    } else if (index.has(key)) {
      fileErrors.push(`The column "${key}" appears twice.`);
    } else {
      index.set(key, i);
    }
  });
  const missing = REQUIRED_COLUMNS.filter((column) => !index.has(column));
  if (missing.length > 0) fileErrors.push(`Missing required columns: ${missing.join(', ')}.`);

  const rows: SheetRow[] = [];
  data.forEach((record, i) => {
    if (record.every((cell) => cell.trim() === '')) return;
    const cells = Object.fromEntries(
      IMPORT_COLUMNS.map((column) => {
        const at = index.get(column);
        return [column, at === undefined ? '' : (record[at] ?? '').trim()];
      }),
    ) as Cells;
    const overflow = record.slice(header.length).some((cell) => cell.trim() !== '');
    rows.push({ row: i + 2, cells, overflow });
  });
  if (rows.length === 0) fileErrors.push('The file has no rows below the header.');
  if (rows.length > MAX_IMPORT_ROWS) {
    fileErrors.push(
      `The file has ${String(rows.length)} rows; the limit is ${String(MAX_IMPORT_ROWS)}. Split it into smaller files.`,
    );
  }

  const warnings =
    ignored.length > 0
      ? [`These columns aren't part of the import format and were ignored: ${ignored.join(', ')}.`]
      : [];
  return { rows, fileErrors, warnings };
}

/** Phones and other values that can't contain a slash: "0917…; 0918… / (045) …". */
const splitList = (cell: string) =>
  cell
    .split(/[;,/\n]+/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

/** Names that may contain a slash ("Spay / neuter"), and links. */
const splitNames = (cell: string) =>
  cell
    .split(/[;,\n]+/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

const YES = new Set(['yes', 'y', 'true', '1', 'oo']);
const NO = new Set(['', 'no', 'n', 'false', '0', 'hindi']);

// ── Matching names to reference data ────────────────────────────────────────────────────

/** Ignores case, accents, punctuation and parentheses: "Peñarubia (Pob.)" → "penarubia". */
function nameKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Also drops what people leave out of place names: "City of Angeles" = "Angeles City" = "Angeles". */
function areaKey(text: string): string {
  return nameKey(text)
    .replace(/^(city of|municipality of|brgy|bgy|barangay) /, '')
    .replace(/ city$/, '');
}

/** Groups items under each of their keys; a key with two items is ambiguous. */
function indexBy<T extends { id: string }>(
  items: readonly T[],
  keysOf: (item: T) => string[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    for (const key of new Set(keysOf(item))) {
      const list = map.get(key) ?? [];
      if (!list.some((other) => other.id === item.id)) list.push(item);
      map.set(key, list);
    }
  }
  return map;
}

interface Area {
  id: string;
  code: string;
  name: string;
}

interface Taxon {
  id: string;
  name: string;
  sortOrder: number;
}

interface Category extends Taxon {
  isGroup: boolean;
  /** Its subcategories, for the "this is a group" message. */
  children: string[];
}

interface Lookups {
  provinces: Map<string, Area[]>;
  /** By `${provinceCode}|${areaKey}`. */
  cities: Map<string, Area[]>;
  /** By `${cityCode}|${areaKey}`. */
  barangays: Map<string, Area[]>;
  species: Map<string, Taxon[]>;
  categories: Map<string, Category[]>;
}

const one = <T>(matches: readonly T[] | undefined): T | undefined =>
  matches?.length === 1 ? matches[0] : undefined;

/**
 * Loads the PSGC areas the file can refer to (provinces, then the cities of the provinces
 * it names, then the barangays of those cities), plus species and service categories.
 */
async function loadLookups(tx: Tx, rows: readonly SheetRow[]): Promise<Lookups> {
  const areaColumns = { code: psgcArea.code, name: psgcArea.name, parentCode: psgcArea.parentCode };
  // indexBy dedupes on `id`; an area's id is its code.
  const withId = <T extends { code: string }>(rows: T[]) =>
    rows.map((row) => ({ ...row, id: row.code }));

  const provinceRows = withId(
    await tx.select(areaColumns).from(psgcArea).where(eq(psgcArea.level, 'province')),
  );
  const provinces = indexBy(provinceRows, (area) => [areaKey(area.name)]);

  const provinceCodes = new Set(
    rows.flatMap((r) => one(provinces.get(areaKey(r.cells.province)))?.code ?? []),
  );
  const cityRows =
    provinceCodes.size === 0
      ? []
      : withId(
          await tx
            .select(areaColumns)
            .from(psgcArea)
            .where(
              and(
                inArray(psgcArea.parentCode, [...provinceCodes]),
                inArray(psgcArea.level, ['city', 'municipality']),
              ),
            ),
        );
  const cities = indexBy(cityRows, (area) => [`${area.parentCode ?? ''}|${areaKey(area.name)}`]);

  const cityCodes = new Set(
    rows.flatMap((r) => {
      const province = one(provinces.get(areaKey(r.cells.province)));
      if (province === undefined) return [];
      return one(cities.get(`${province.code}|${areaKey(r.cells.city)}`))?.code ?? [];
    }),
  );
  const barangayRows =
    cityCodes.size === 0
      ? []
      : withId(
          await tx
            .select(areaColumns)
            .from(psgcArea)
            .where(
              and(inArray(psgcArea.parentCode, [...cityCodes]), eq(psgcArea.level, 'barangay')),
            ),
        );
  const barangays = indexBy(barangayRows, (area) => [
    `${area.parentCode ?? ''}|${areaKey(area.name)}`,
  ]);

  const speciesRows = await tx
    .select({
      id: species.id,
      code: species.code,
      name: species.name,
      sortOrder: species.sortOrder,
    })
    .from(species);
  const categoryRows = await tx
    .select({
      id: serviceCategory.id,
      code: serviceCategory.code,
      name: serviceCategory.name,
      synonyms: serviceCategory.synonyms,
      parentId: serviceCategory.parentId,
      sortOrder: serviceCategory.sortOrder,
    })
    .from(serviceCategory)
    .orderBy(asc(serviceCategory.sortOrder), asc(serviceCategory.name));
  const categories: (Category & { code: string; synonyms: string[] })[] = categoryRows.map(
    (row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      synonyms: row.synonyms,
      sortOrder: row.sortOrder,
      isGroup: row.parentId === null,
      children: categoryRows.filter((c) => c.parentId === row.id).map((c) => c.name),
    }),
  );

  return {
    provinces,
    cities,
    barangays,
    species: indexBy(speciesRows, (s) => [nameKey(s.code), nameKey(s.name)]),
    categories: indexBy(categories, (c) => [
      nameKey(c.code),
      nameKey(c.name),
      ...c.synonyms.map(nameKey),
    ]),
  };
}

// ── Checking one row (one branch) ───────────────────────────────────────────────────────

interface BranchDraft {
  row: number;
  businessName: string;
  dataSource: string;
  branchName: string;
  city: string;
  errors: CellError[];
  /** Null when the row has errors. */
  input: CreateBranchInput | null;
  is24h: boolean;
  weekly: WeeklyInterval[];
  speciesTreated: Taxon[];
  services: Category[];
  hoursConfirmedAt: Date | null;
  /** Its phone and Viber numbers (E.164), for duplicate checks. */
  phones: string[];
}

const HOURS_TEXT_MESSAGES: Record<DayHoursTextIssue, (part: string) => string> = {
  unreadable: (part) =>
    `Can't read "${part}". Write hours like 8am-5pm, 08:00-17:00 or 8am-12nn, 1pm-5pm, or "closed".`,
  ambiguous: (part) =>
    `"${part}" could be morning or afternoon. Add am/pm (8am-5pm) or use the 24-hour clock (08:00-17:00).`,
  all_day: () =>
    'For a branch open around the clock, set open_24h to yes and leave the days empty.',
};

/** Where a CreateBranchSchema issue belongs in the CSV. */
function branchColumn(path: readonly PropertyKey[], contactColumns: readonly Column[]): Column {
  const [field, index] = path;
  switch (field) {
    case 'name':
    case 'slug':
      return 'branch';
    case 'addressLine':
      return 'address';
    case 'location':
      return 'coordinates';
    case 'acceptsEmergencies':
      return 'accepts_emergencies';
    case 'provinceCode':
      return 'province';
    case 'cityCode':
      return 'city';
    case 'barangayCode':
      return 'barangay';
    default:
      return (typeof index === 'number' ? contactColumns[index] : undefined) ?? 'phones';
  }
}

function checkRow(
  { row, cells, overflow }: SheetRow,
  lookups: Lookups,
  today: string,
): BranchDraft {
  const errors: CellError[] = [];
  const fail = (column: Column | null, message: string) => {
    errors.push({ column, message });
  };
  const failed = (column: Column) => errors.some((error) => error.column === column);

  if (overflow) fail(null, 'This row has more cells than the header has columns.');
  if (cells.business === '') fail('business', 'Enter the business name.');
  for (const column of ['address', 'province', 'city', 'coordinates'] as const) {
    if (cells[column] === '') fail(column, 'Required.');
  }

  // Address areas, by name, each inside the one before.
  let provinceCode: string | null = null;
  let cityCode: string | null = null;
  let barangayCode: string | null = null;
  if (cells.province !== '') {
    const matches = lookups.provinces.get(areaKey(cells.province)) ?? [];
    if (matches.length === 1) provinceCode = matches[0]?.code ?? null;
    else fail('province', `No province named "${cells.province}" has address data in PAW.`);
  }
  if (provinceCode !== null && cells.city !== '') {
    const matches = lookups.cities.get(`${provinceCode}|${areaKey(cells.city)}`) ?? [];
    if (matches.length === 1) cityCode = matches[0]?.code ?? null;
    else if (matches.length === 0) {
      fail('city', `No city or municipality named "${cells.city}" in ${cells.province}.`);
    } else {
      fail('city', `"${cells.city}" matches more than one place: write it as the PSA does.`);
    }
  }
  if (cityCode !== null && cells.barangay !== '') {
    const matches = lookups.barangays.get(`${cityCode}|${areaKey(cells.barangay)}`) ?? [];
    if (matches.length === 1) barangayCode = matches[0]?.code ?? null;
    else if (matches.length === 0) {
      fail('barangay', `No barangay named "${cells.barangay}" in ${cells.city}.`);
    } else {
      fail(
        'barangay',
        `"${cells.barangay}" matches more than one barangay: write it as the PSA does.`,
      );
    }
  }

  let location = { lng: 0, lat: 0 };
  if (cells.coordinates !== '') {
    const parsed = parseLatLng(cells.coordinates);
    const [first, second] = cells.coordinates.split(/[\s,]+/);
    const swapped = parseLatLng(`${second ?? ''}, ${first ?? ''}`);
    if (parsed === null) {
      fail(
        'coordinates',
        swapped === null
          ? 'Paste "lat, lng" from Google Maps, e.g. 15.1450, 120.5887.'
          : 'Latitude comes first: "lat, lng" as Google Maps copies it, e.g. 15.1450, 120.5887.',
      );
    } else {
      location = parsed;
    }
  }

  const yesNo = (column: 'accepts_emergencies' | 'open_24h') => {
    const value = cells[column].toLowerCase();
    if (YES.has(value)) return true;
    if (!NO.has(value)) fail(column, `Write yes or no (not "${cells[column]}").`);
    return false;
  };
  const acceptsEmergencies = yesNo('accepts_emergencies');
  const is24h = yesNo('open_24h');

  // Contacts, in the order the clinic page lists them.
  const contacts: { type: 'phone' | 'viber' | 'messenger' | 'email'; value: string }[] = [];
  const contactColumns: Column[] = [];
  const addContacts = (
    column: Column,
    type: (typeof contacts)[number]['type'],
    values: string[],
  ) => {
    for (const value of values) {
      contacts.push({ type, value });
      contactColumns.push(column);
    }
  };
  addContacts('phones', 'phone', splitList(cells.phones));
  addContacts('viber', 'viber', splitList(cells.viber));
  addContacts(
    'messenger',
    'messenger',
    splitNames(cells.messenger).map((link) => (link.includes('://') ? link : `https://${link}`)),
  );
  addContacts('email', 'email', splitNames(cells.email));

  // Weekly hours: all seven days, or none (hours unknown, UX17).
  const days = DAY_COLUMNS.map((column) => ({ column, parsed: parseDayHours(cells[column]) }));
  for (const { column, parsed } of days) {
    if (parsed.kind === 'invalid') fail(column, HOURS_TEXT_MESSAGES[parsed.issue](parsed.part));
  }
  const filled = days.filter(({ parsed }) => parsed.kind !== 'blank');
  if (is24h && filled.length > 0) {
    fail('open_24h', 'A branch open 24 hours has no day hours: leave mon to sun empty.');
  } else if (filled.length > 0 && filled.length < DAY_COLUMNS.length) {
    for (const { column, parsed } of days) {
      if (parsed.kind === 'blank') {
        fail(
          column,
          'Write the hours or "closed" (leave all seven days empty if the hours are unknown).',
        );
      }
    }
  }
  const weekly = days.flatMap(({ parsed }, i) =>
    parsed.kind === 'open'
      ? parsed.intervals.map((interval) => ({ ...interval, dayOfWeek: i + 1 }))
      : [],
  );
  const hours = ReplaceHoursSchema.safeParse({ is24h, weekly });
  if (!hours.success) {
    for (const issue of hours.error.issues) {
      const [, index] = issue.path;
      const day = typeof index === 'number' ? weekly[index]?.dayOfWeek : undefined;
      const column = day === undefined ? null : (DAY_COLUMNS[day - 1] ?? null);
      if (column === null || !failed(column)) fail(column, issue.message);
    }
  }

  const speciesTreated: Taxon[] = [];
  for (const item of splitNames(cells.species)) {
    const matches = lookups.species.get(nameKey(item)) ?? [];
    const match = one(matches);
    if (match === undefined) {
      fail(
        'species',
        matches.length === 0
          ? `Unknown species "${item}". Use the names in PAW's species list, e.g. Dog, Cat.`
          : `"${item}" matches more than one species.`,
      );
    } else if (!speciesTreated.includes(match)) {
      speciesTreated.push(match);
    }
  }
  speciesTreated.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const services: Category[] = [];
  for (const item of splitNames(cells.services)) {
    const matches = lookups.categories.get(nameKey(item)) ?? [];
    const match = one(matches);
    if (match === undefined) {
      fail(
        'services',
        matches.length === 0
          ? `Unknown service "${item}". Use a service name from PAW's list or a common synonym (e.g. kapon).`
          : `"${item}" matches more than one service.`,
      );
    } else if (match.isGroup) {
      const examples = match.children.slice(0, 3).join(', ');
      fail(
        'services',
        `"${item}" is a group of services. Name the specific ones, e.g. ${examples}.`,
      );
    } else if (!services.includes(match)) {
      services.push(match);
    }
  }

  let hoursConfirmedAt: Date | null = null;
  if (cells.confirmed_on !== '') {
    const date = cells.confirmed_on;
    const hoursFailed = DAY_COLUMNS.some(failed) || failed('open_24h');
    if (!z.iso.date().safeParse(date).success) {
      fail(
        'confirmed_on',
        `Write the date as YYYY-MM-DD, e.g. ${today} (in Google Sheets, format the column as plain text).`,
      );
    } else if (date > today) {
      fail('confirmed_on', 'This date is in the future.');
    } else if (!is24h && weekly.length === 0) {
      if (!hoursFailed) {
        fail(
          'confirmed_on',
          'There are no hours to confirm: fill in the days (or open_24h), or leave this empty.',
        );
      }
    } else {
      // The start of that day in Manila: freshness (UX5) counts days from it.
      hoursConfirmedAt = new Date(`${date}T00:00:00+08:00`);
    }
  }

  // The branch fields go through the same schema as the admin's branch form, so the rules
  // and messages (phones, links, the pin in the Philippines) are the same.
  const branchName = cells.branch === '' ? cells.city : cells.branch;
  const slug = slugify(branchName);
  if (branchName !== '' && slug === '') fail('branch', 'The branch name needs letters or digits.');
  // Columns reported above get no second, vaguer message from the schema.
  const reported = new Set(errors.map((error) => error.column));
  const parsed = CreateBranchSchema.safeParse({
    name: branchName,
    slug: slug === '' ? 'branch' : slug,
    addressLine: cells.address,
    provinceCode: provinceCode ?? '0000000000',
    cityCode: cityCode ?? '0000000000',
    barangayCode,
    location,
    acceptsEmergencies,
    listingStatus: 'published',
    contacts: contacts.map((contact) => ({ ...contact, label: null })),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const column = branchColumn(issue.path, contactColumns);
      if (reported.has(column)) continue;
      const [field, index] = issue.path;
      const value =
        field === 'contacts' && typeof index === 'number' ? contacts[index]?.value : undefined;
      fail(column, value === undefined ? issue.message : `${issue.message} ("${value}")`);
    }
  }

  return {
    row,
    businessName: cells.business,
    dataSource: cells.data_source,
    branchName,
    city: cells.city,
    errors,
    input: errors.length === 0 && parsed.success ? parsed.data : null,
    is24h,
    weekly,
    speciesTreated,
    services,
    hoursConfirmedAt,
    phones: contacts
      .filter((contact) => contact.type === 'phone' || contact.type === 'viber')
      .flatMap((contact) => normalizePhPhone(contact.value) ?? []),
  };
}

// ── Grouping rows into businesses ───────────────────────────────────────────────────────

interface BusinessDraft {
  key: string;
  name: string;
  slug: string;
  dataSource: string | null;
  errors: CellError[];
  duplicates: Duplicate[];
  branches: BranchDraft[];
}

/** Rows with the same business name (ignoring case and spacing) are one business. */
const businessKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

function groupRows(drafts: readonly BranchDraft[]): BusinessDraft[] {
  const groups = new Map<string, BranchDraft[]>();
  for (const draft of drafts) {
    // A row without a business name stands alone (it's invalid anyway).
    const key =
      draft.businessName === '' ? `row ${String(draft.row)}` : businessKey(draft.businessName);
    groups.set(key, [...(groups.get(key) ?? []), draft]);
  }

  return [...groups].map(([key, branches]) => {
    const name = branches[0]?.businessName ?? '';
    const errors: CellError[] = [];

    const sources = [...new Set(branches.map((b) => b.dataSource).filter((s) => s !== ''))];
    if (sources.length === 0) {
      errors.push({
        column: 'data_source',
        message: 'Say where the details came from, e.g. "Called the clinic" or "Facebook page".',
      });
    } else if (sources.length > 1) {
      errors.push({
        column: 'data_source',
        message: `Its rows give different data sources (${sources.map((s) => `"${s}"`).join(', ')}): use one.`,
      });
    }

    const slug = slugify(name);
    if (name !== '' && slug === '') {
      errors.push({ column: 'business', message: 'The business name needs letters or digits.' });
    }
    const parsed = CreateBusinessSchema.safeParse({
      name,
      slug: slug === '' ? 'business' : slug,
      type: 'vet_clinic',
      dataSource: sources[0] ?? null,
    });
    if (!parsed.success && name !== '') {
      for (const issue of parsed.error.issues) {
        const column = issue.path[0] === 'dataSource' ? 'data_source' : 'business';
        if (!errors.some((error) => error.column === column)) {
          errors.push({ column, message: issue.message });
        }
      }
    }

    // Branch slugs must differ within a business.
    const seen = new Set<string>();
    for (const draft of branches) {
      const branchSlug = draft.input?.slug;
      if (branchSlug === undefined) continue;
      if (seen.has(branchSlug)) {
        draft.errors.push({
          column: 'branch',
          message:
            'Another row of this business has the same branch name. Give each branch its own.',
        });
        draft.input = null;
      }
      seen.add(branchSlug);
    }

    return { key, name, slug, dataSource: sources[0] ?? null, errors, duplicates: [], branches };
  });
}

const isValid = (group: BusinessDraft) =>
  group.errors.length === 0 && group.branches.every((b) => b.errors.length === 0);

// ── Duplicates ──────────────────────────────────────────────────────────────────────────

/** Adds likely duplicates to each business: by phone, then by a similar name nearby. */
async function findDuplicates(tx: Tx, groups: readonly BusinessDraft[]): Promise<void> {
  const allPhones = [...new Set(groups.flatMap((g) => g.branches.flatMap((b) => b.phones)))];
  const phoneMatches =
    allPhones.length === 0
      ? []
      : await tx
          .select({
            phone: branchContact.value,
            businessId: business.id,
            businessName: business.name,
            branchName: branch.name,
          })
          .from(branchContact)
          .innerJoin(branch, eq(branch.id, branchContact.branchId))
          .innerJoin(business, eq(business.id, branch.businessId))
          .where(
            and(
              inArray(branchContact.type, ['phone', 'viber']),
              inArray(branchContact.value, allPhones),
            ),
          );

  // The same number in two businesses of this file.
  const inFile = new Map<string, { group: BusinessDraft; draft: BranchDraft }[]>();
  for (const group of groups) {
    for (const draft of group.branches) {
      for (const phone of new Set(draft.phones)) {
        inFile.set(phone, [...(inFile.get(phone) ?? []), { group, draft }]);
      }
    }
  }

  for (const group of groups) {
    const found: Duplicate[] = [];
    const add = (duplicate: Duplicate) => {
      const same = found.some(
        (d) =>
          d.reason === duplicate.reason &&
          d.businessId === duplicate.businessId &&
          d.row === duplicate.row &&
          d.branchName === duplicate.branchName,
      );
      if (!same) found.push(duplicate);
    };

    for (const draft of group.branches) {
      for (const phone of new Set(draft.phones)) {
        for (const match of phoneMatches.filter((m) => m.phone === phone)) {
          add({ reason: 'phone', ...match, row: null, distanceMeters: null, phone });
        }
        for (const other of inFile.get(phone) ?? []) {
          if (other.group === group) continue;
          add({
            reason: 'phone',
            businessId: null,
            businessName: other.group.name,
            branchName: other.draft.branchName,
            row: other.draft.row,
            distanceMeters: null,
            phone,
          });
        }
      }

      // Only rows that passed have a usable location.
      if (draft.input === null) continue;
      const { lng, lat } = draft.input.location;
      const point = sql`ST_SetSRID(ST_Point(${lng}, ${lat}), 4326)::geography`;
      const nearby = await tx
        .select({
          businessId: business.id,
          businessName: business.name,
          branchName: branch.name,
          distanceMeters: sql`round(ST_Distance(${branch.location}, ${point}))`.mapWith(Number),
        })
        .from(branch)
        .innerJoin(business, eq(business.id, branch.businessId))
        .where(
          and(
            sql`ST_DWithin(${branch.location}, ${point}, ${DUPLICATE_RADIUS_METERS})`,
            sql`similarity(${business.name}, ${group.name}) >= ${DUPLICATE_NAME_SIMILARITY}`,
          ),
        )
        .orderBy(sql`${branch.location} <-> ${point}`)
        .limit(5);
      for (const match of nearby) {
        add({ reason: 'name_nearby', ...match, row: null, phone: null });
      }
    }
    group.duplicates = found;
  }
}

// ── Writing ─────────────────────────────────────────────────────────────────────────────

/** The business's slug, or its first free "-2", "-3", … variant (slugs are unique). */
async function freeSlug(tx: Tx, base: string, reserved: Set<string>): Promise<string> {
  const rows = await tx
    .select({ slug: business.slug })
    .from(business)
    .where(or(eq(business.slug, base), like(business.slug, `${base}-%`)));
  const taken = new Set([...rows.map((row) => row.slug), ...reserved]);
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) {
    const suffix = `-${String(n)}`;
    slug = `${base.slice(0, 80 - suffix.length).replace(/-+$/, '')}${suffix}`;
  }
  reserved.add(slug);
  return slug;
}

const BRANCH_IMPORT_FIELDS = [
  ...BRANCH_AUDITED_FIELDS,
  'is24h',
  'weeklyHours',
  'hoursConfirmedAt',
  'hoursConfirmedBy',
  'speciesTreated',
  'services',
] as const;

const nonEmpty = <T>(list: T[]) => (list.length === 0 ? undefined : list);

async function writeBranch(tx: Tx, actorId: string, businessId: string, draft: BranchDraft) {
  if (draft.input === null) throw new Error('only valid rows are written');
  const { contacts, ...fields } = draft.input;
  const hoursConfirmedBy = draft.hoursConfirmedAt === null ? null : ('paw_ops' as const);
  const [row] = await tx
    .insert(branch)
    .values({
      ...fields,
      businessId,
      is24h: draft.is24h,
      hoursConfirmedAt: draft.hoursConfirmedAt,
      hoursConfirmedBy,
    })
    .returning();
  if (row === undefined) throw new Error('insert returned no row');
  const branchId = row.id;

  await replaceContacts(tx, branchId, contacts);
  const weekly = [...draft.weekly].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.opensAt.localeCompare(b.opensAt),
  );
  if (weekly.length > 0) {
    await tx.insert(branchHours).values(weekly.map((interval) => ({ ...interval, branchId })));
  }
  if (draft.speciesTreated.length > 0) {
    await tx
      .insert(branchSpecies)
      .values(draft.speciesTreated.map((s) => ({ branchId, speciesId: s.id })));
  }
  // No prices yet ("Call for price") and no species per service: both are added in the
  // Services tab, where the price rules (UX10) are checked.
  if (draft.services.length > 0) {
    await tx.insert(branchService).values(
      draft.services.map((category, sortOrder) => ({
        branchId,
        categoryId: category.id,
        name: category.name,
        sortOrder,
      })),
    );
  }

  await recordAudit(tx, {
    actorId,
    action: 'branch.import',
    entityType: 'branch',
    entityId: branchId,
    diff: diffFields(
      null,
      {
        ...row,
        contacts: nonEmpty(auditContacts(contacts)),
        weeklyHours: nonEmpty(weekly),
        speciesTreated: nonEmpty(draft.speciesTreated.map((s) => s.name)),
        services: nonEmpty(draft.services.map((c) => c.name)),
      },
      BRANCH_IMPORT_FIELDS,
    ),
  });
}

async function writeBusiness(tx: Tx, actorId: string, group: BusinessDraft, slug: string) {
  const [row] = await tx
    .insert(business)
    .values({ name: group.name.trim(), slug, type: 'vet_clinic', dataSource: group.dataSource })
    .returning();
  if (row === undefined) throw new Error('insert returned no row');
  await recordAudit(tx, {
    actorId,
    action: 'business.import',
    entityType: 'business',
    entityId: row.id,
    diff: diffFields(null, row, BUSINESS_AUDITED_FIELDS),
  });
  for (const draft of group.branches) await writeBranch(tx, actorId, row.id, draft);
  return row.id;
}

// ── The import ──────────────────────────────────────────────────────────────────────────

/**
 * Checks a CSV of listings and, unless it's a dry run, imports the businesses that passed:
 * new ones, plus likely duplicates listed in `importAnyway`. Imported businesses start
 * hidden (like any new listing); their branches are published. `now` decides which
 * confirmation dates are in the future.
 */
export async function importListings(
  db: Db,
  actorId: string,
  input: ImportCsvInput,
  now: Date,
): Promise<ImportResult> {
  const sheet = readSheet(input.csv);
  const base = { dryRun: input.dryRun, fileErrors: sheet.fileErrors, warnings: sheet.warnings };
  if (sheet.fileErrors.length > 0) return { ...base, businesses: [] };

  const today = toManila(now).date;
  const importAnyway = new Set(input.importAnyway);
  try {
    return await db.transaction(async (tx) => {
      const lookups = await loadLookups(tx, sheet.rows);
      const groups = groupRows(sheet.rows.map((row) => checkRow(row, lookups, today)));
      await findDuplicates(tx, groups);

      const reserved = new Set<string>();
      const businesses: ImportResult['businesses'] = [];
      for (const group of groups) {
        let status: ImportStatus = !isValid(group)
          ? 'invalid'
          : group.duplicates.length > 0
            ? 'duplicate'
            : 'new';
        let businessId: string | null = null;
        if (!input.dryRun && status !== 'invalid') {
          if (status === 'new' || importAnyway.has(group.key)) {
            businessId = await writeBusiness(
              tx,
              actorId,
              group,
              await freeSlug(tx, group.slug, reserved),
            );
            status = 'imported';
          } else {
            status = 'skipped';
          }
        }
        businesses.push({
          key: group.key,
          name: group.name,
          status,
          businessId,
          errors: group.errors,
          duplicates: group.duplicates,
          rows: group.branches.map((draft) => ({
            row: draft.row,
            branch: draft.branchName,
            city: draft.city,
            errors: draft.errors,
          })),
        });
      }
      return { ...base, businesses };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'business_slug_unique')) {
      throw httpError(
        409,
        'Another listing was saved with the same slug during the import. Run it again.',
      );
    }
    throw error;
  }
}
