import type { FastifyBaseLogger } from 'fastify';
import pg from 'pg';

/** What the API needs from the database so far. P0-T3 moves this into packages/db. */
export interface Database {
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string, log: FastifyBaseLogger): Database {
  // A pool keeps a few connections open and hands them out per query.
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2_000 });

  // An idle connection can drop (e.g. the database restarts). Without a listener
  // the "error" event would crash the process; the pool reconnects on the next query.
  pool.on('error', (error) => {
    log.error({ err: error }, 'idle database connection failed');
  });

  return {
    async ping() {
      await pool.query('select 1');
    },
    close: () => pool.end(),
  };
}
