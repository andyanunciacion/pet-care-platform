import { buildApp } from './app.ts';
import { parseEnv, type Env } from './env.ts';

let env: Env;
try {
  env = parseEnv(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = await buildApp({ env });

// Hosting platforms send SIGTERM before replacing the process; Ctrl+C sends SIGINT.
// Closing lets in-flight requests finish and releases database connections.
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
}
process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  if (env.NODE_ENV === 'development') {
    app.log.info(`API docs: http://localhost:${env.PORT}/docs`);
  }
} catch (error) {
  app.log.fatal({ err: error }, 'failed to start');
  process.exit(1);
}
