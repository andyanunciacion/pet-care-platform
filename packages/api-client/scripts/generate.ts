// `pnpm api:generate`: run after changing an API route, then commit both files.
import { writeFile } from 'node:fs/promises';
import { generateClientFiles, OPENAPI_FILE, SCHEMA_FILE } from '../src/generate.ts';

const { openapi, schema } = await generateClientFiles();
await writeFile(OPENAPI_FILE, openapi);
await writeFile(SCHEMA_FILE, schema);
console.log('Wrote packages/api-client/openapi.json and src/schema.ts');
