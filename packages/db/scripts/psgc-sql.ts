// `pnpm --filter @paw/db psgc:sql`: turns the PSA's PSGC publication (.xlsx) into SQL
// that inserts one province's cities, municipalities and barangays into psgc_area.
//
// Usage (paths relative to packages/db):
//   pnpm --filter @paw/db psgc:sql --xlsx <datafile.xlsx> --province <code> [--huc <code>]… --out <file.sql>
//
// Download the latest "PSGC Publication Datafile" from https://psa.gov.ph/classification/psgc.
// --huc attaches a highly urbanized city (which PSGC lists outside any province) to the
// province, so it nests there in PAW's URLs, e.g. City of Angeles under Pampanga.
// Write the output into a custom migration (`pnpm db:generate --custom --name=psgc-<province>`).
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { inflateRawSync } from 'node:zlib';

/** Reads one file out of a .zip (an .xlsx is a zip of XML files). */
function readZipEntry(zip: Buffer, name: string): string {
  // The central directory lists every file; its location is in the record at the end.
  const endOfDirectory = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOfDirectory < 0) throw new Error('Not a zip file');
  let offset = zip.readUInt32LE(endOfDirectory + 16);

  while (zip.readUInt32LE(offset) === 0x02014b50) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeader = zip.readUInt32LE(offset + 42);
    const entryName = zip.toString('utf8', offset + 46, offset + 46 + nameLength);

    if (entryName === name) {
      const dataStart =
        localHeader + 30 + zip.readUInt16LE(localHeader + 26) + zip.readUInt16LE(localHeader + 28);
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      // 0 = stored, 8 = deflate (the only two methods .xlsx files use).
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${name} not found in the .xlsx`);
}

const decodeXml = (text: string) =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

interface Area {
  code: string;
  name: string;
  /** PSGC's level: Reg, Prov, City, Mun, SubMun or Bgy. */
  level: string;
}

/** Reads the "PSGC" sheet: column A = code, B = name, D = geographic level. */
function readAreas(xlsx: Buffer): Area[] {
  const workbook = readZipEntry(xlsx, 'xl/workbook.xml');
  const relationId = /<sheet name="PSGC"[^>]*r:id="([^"]+)"/.exec(workbook)?.[1];
  const relations = readZipEntry(xlsx, 'xl/_rels/workbook.xml.rels');
  const target = new RegExp(`Id="${relationId ?? ''}"[^>]*Target="([^"]+)"`).exec(relations)?.[1];
  if (target === undefined) throw new Error('No "PSGC" sheet in the .xlsx');

  // Text cells point into a shared list of strings (rich text is split into several <t> runs).
  const sharedStrings = [
    ...readZipEntry(xlsx, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map(([, item = '']) =>
    decodeXml([...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(([, run]) => run).join('')),
  );

  const areas: Area[] = [];
  const sheet = readZipEntry(xlsx, `xl/${target}`);
  for (const [, row = ''] of sheet.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const [, column = '', attributes = '', inner = ''] of row.matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '';
      cells[column] = attributes.includes('t="s"')
        ? (sharedStrings[Number(value)] ?? '')
        : decodeXml(value);
    }
    const { A: code = '', B: name = '', D: level = '' } = cells;
    if (/^\d{10}$/.test(code)) areas.push({ code, name: name.trim(), level });
  }
  return areas;
}

const { values: args } = parseArgs({
  options: {
    xlsx: { type: 'string' },
    province: { type: 'string' },
    huc: { type: 'string', multiple: true, default: [] },
    out: { type: 'string' },
  },
});
if (args.xlsx === undefined || args.province === undefined || args.out === undefined) {
  console.error('Usage: psgc:sql --xlsx <file> --province <code> [--huc <code>]… --out <file.sql>');
  process.exit(1);
}

const areas = readAreas(readFileSync(args.xlsx));
const byCode = new Map(areas.map((area) => [area.code, area]));
const province = byCode.get(args.province);
if (province?.level !== 'Prov') throw new Error(`${args.province} is not a province`);

// Codes are RR PPP MM BBB: region, province, city/municipality, barangay.
const provincePrefix = province.code.slice(0, 5);
const cities = areas.filter(
  (area) =>
    (area.level === 'City' || area.level === 'Mun') &&
    (area.code.startsWith(provincePrefix) || args.huc.includes(area.code)),
);
for (const code of args.huc) {
  if (byCode.get(code)?.level !== 'City') throw new Error(`${code} is not a city`);
}
const cityCodes = new Set(cities.map((city) => city.code));
const barangays = areas.filter(
  (area) => area.level === 'Bgy' && cityCodes.has(`${area.code.slice(0, 7)}000`),
);

const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
const insert = (rows: string[]) =>
  `INSERT INTO psgc_area (code, name, level, parent_code) VALUES\n${rows.join(',\n')};`;

const sql = [
  `-- PSGC: ${province.name} (${String(cities.length)} cities/municipalities, ${String(barangays.length)} barangays).`,
  `-- Generated by packages/db/scripts/psgc-sql.ts from the PSA's PSGC publication datafile.`,
  ...(args.huc.length > 0
    ? [`-- Highly urbanized cities attached to the province: ${args.huc.join(', ')}.`]
    : []),
  insert([`  (${quote(province.code)}, ${quote(province.name)}, 'province', NULL)`]),
  '--> statement-breakpoint',
  insert(
    cities.map(
      (city) =>
        `  (${quote(city.code)}, ${quote(city.name)}, '${city.level === 'City' ? 'city' : 'municipality'}', ${quote(province.code)})`,
    ),
  ),
  '--> statement-breakpoint',
  insert(
    barangays.map(
      (barangay) =>
        `  (${quote(barangay.code)}, ${quote(barangay.name)}, 'barangay', ${quote(`${barangay.code.slice(0, 7)}000`)})`,
    ),
  ),
  '',
].join('\n');

writeFileSync(args.out, sql);
console.log(
  `${province.name}: ${String(cities.length)} cities/municipalities, ${String(barangays.length)} barangays → ${args.out}`,
);
