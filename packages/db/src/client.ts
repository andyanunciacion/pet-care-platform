import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.ts';

export type Db = NodePgDatabase<typeof schema>;

export interface Database {
  /** Drizzle query builder. */
  db: Db;
  /** Throws if the database can't be reached. */
  ping(): Promise<void>;
  /** Closes all connections; call on shutdown. */
  close(): Promise<void>;
}

export interface DatabaseOptions {
  connectionString: string;
  /** Called when an idle connection fails (e.g. the database restarts). */
  onIdleError?: (error: Error) => void;
}

export function createDatabase({ connectionString, onIdleError }: DatabaseOptions): Database {
  // A pool keeps a few connections open and hands them out per query.
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2_000 });

  // Without an "error" listener, a dropped idle connection would crash the process.
  // The pool discards it and reconnects on the next query.
  pool.on('error', (error) => {
    onIdleError?.(error);
  });

  return {
    // snake_case: TypeScript fields like hoursConfirmedAt map to hours_confirmed_at columns.
    db: drizzle({ client: pool, schema, casing: 'snake_case' }),
    async ping() {
      await pool.query('select 1');
    },
    close: () => pool.end(),
  };
}
