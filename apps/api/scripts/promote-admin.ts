// `pnpm --filter @paw/api promote-admin --email <email> [--role super_admin|user]`
//
// Gives a user access to /admin (or takes it away with --role user). The user must have
// signed in once first. Reads DATABASE_URL from apps/api/.env locally; on staging, run it
// inside the Railway API service (see CLAUDE.md). Every change is written to audit_log.
import { parseArgs } from 'node:util';
import { createDatabase, databaseUrlFromEnv } from '@paw/db';
import { z } from 'zod';
import { PLATFORM_ROLES } from '../src/auth.ts';
import { setPlatformRole } from '../src/platform-role.ts';

const ArgsSchema = z.object({
  email: z.email(),
  role: z.enum(PLATFORM_ROLES).default('super_admin'),
});

const { values } = parseArgs({
  options: { email: { type: 'string' }, role: { type: 'string' } },
});
const args = ArgsSchema.safeParse(values);
if (!args.success) {
  console.error(`Invalid arguments:\n${z.prettifyError(args.error)}`);
  console.error('Usage: promote-admin --email <email> [--role super_admin|user]');
  process.exit(1);
}

const database = createDatabase({ connectionString: databaseUrlFromEnv() });
try {
  const { from, to } = await setPlatformRole(database.db, args.data);
  console.log(from === to ? `Already ${to}; nothing changed.` : `Changed ${from} → ${to}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.close();
}
