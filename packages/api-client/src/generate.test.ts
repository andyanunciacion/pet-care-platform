import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generateClientFiles, OPENAPI_FILE, SCHEMA_FILE } from './generate.ts';

// Fails when an API route changed but the client wasn't regenerated.
describe('generated client', () => {
  it('is up to date with the API (run `pnpm api:generate` if this fails)', async () => {
    const { openapi, schema } = await generateClientFiles();
    expect(await readFile(OPENAPI_FILE, 'utf8')).toBe(openapi);
    expect(await readFile(SCHEMA_FILE, 'utf8')).toBe(schema);
  });
});
