// `pnpm lighthouse`: checks a public clinic page against the performance budget (DESIGN §9,
// ARCHITECTURE D44), locally and in CI alike. It seeds the fixture listing (seed.ts), serves
// its images in place of the photo bucket, builds the web app and starts it with the API on
// their own ports (so a running `pnpm dev` is left alone), then runs Lighthouse CI against
// the page with the assertions in lighthouserc.json. Reports land in .lighthouseci/.
//
// Needs the Docker Postgres (DATABASE_URL, default the local one) and Chrome.
// `--skip-build` reuses the last web build (only when nothing in apps/web changed);
// `--serve` starts everything without Lighthouse and keeps it running, to look at the page.
import { spawn, type ChildProcess } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import path from 'node:path';
import { EDGE_CASE_PATH, FIXTURE_PATH, IMAGES_DIR, seedFixture } from './seed.ts';

const ROOT = path.join(import.meta.dirname, '..', '..', '..');
const WEB_DIR = path.join(ROOT, 'apps', 'web');
const API_DIR = path.join(ROOT, 'apps', 'api');
const PACKAGE_DIR = path.join(import.meta.dirname, '..');

const LOCAL_DATABASE_URL = 'postgres://paw:paw@localhost:5432/paw';
const WEB_PORT = 3100;
const API_PORT = 4001;
const IMAGES_PORT = 4100;

const WEB_URL = `http://localhost:${String(WEB_PORT)}`;
const API_URL = `http://127.0.0.1:${String(API_PORT)}`;
const PHOTOS_URL = `http://127.0.0.1:${String(IMAGES_PORT)}`;

/** The web app's settings for the build and the server (they override apps/web/.env). */
const webEnv = { API_URL, SITE_URL: WEB_URL, PHOTOS_URL, NEXT_TELEMETRY_DISABLED: '1' };

/**
 * The API's settings. Auth and R2 get stand-ins: nobody signs in, and the API only uses
 * R2_PUBLIC_URL to build image URLs (no call reaches Cloudflare).
 */
const apiEnv = (databaseUrl: string) => ({
  NODE_ENV: 'production',
  LOG_LEVEL: 'warn',
  HOST: '127.0.0.1',
  PORT: String(API_PORT),
  DATABASE_URL: databaseUrl,
  CORS_ORIGINS: WEB_URL,
  BETTER_AUTH_URL: WEB_URL,
  BETTER_AUTH_SECRET: 'lighthouse-placeholder-secret-of-32-characters',
  GOOGLE_CLIENT_ID: 'lighthouse-placeholder',
  GOOGLE_CLIENT_SECRET: 'lighthouse-placeholder',
  R2_ACCOUNT_ID: 'lighthouse-placeholder',
  R2_ACCESS_KEY_ID: 'lighthouse-placeholder',
  R2_SECRET_ACCESS_KEY: 'lighthouse-placeholder',
  R2_BUCKET: 'lighthouse-placeholder',
  R2_PUBLIC_URL: PHOTOS_URL,
});

const children: ChildProcess[] = [];

/** Runs `node <script> …args` and resolves with its exit code. */
function node(script: string, args: string[], cwd: string, env: Record<string, string>) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  children.push(child);
  const exited = new Promise<number>((resolve) => {
    child.once('exit', (code) => {
      resolve(code ?? 1);
    });
  });
  return { child, exited };
}

/** The image files, with the photo bucket's cache header (D38: objects never change). */
function serveImages(): Promise<Server> {
  const server = createServer((request, response) => {
    const name = path.basename(new URL(request.url ?? '/', PHOTOS_URL).pathname);
    const file = path.join(IMAGES_DIR, name);
    stat(file).then(
      (info) => {
        response.writeHead(200, {
          'content-type': 'image/png',
          'content-length': String(info.size),
          'cache-control': 'public, max-age=31536000, immutable',
        });
        createReadStream(file).pipe(response);
      },
      () => {
        response.writeHead(404).end();
      },
    );
  });
  return new Promise((resolve) => {
    server.listen(IMAGES_PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

/**
 * Fails if something already listens on the port: Lighthouse would otherwise measure that
 * server (an older build, say) instead of this one.
 */
async function ensurePortFree(port: number): Promise<void> {
  // Connecting tells reliably (a listen test can miss a server bound to 127.0.0.1 only).
  const inUse = await new Promise<boolean>((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
  if (inUse) throw new Error(`Port ${String(port)} is in use. Stop whatever runs there and retry.`);
}

/**
 * Waits until the URL answers 200 (the servers take a few seconds to start), or fails as
 * soon as the server behind it exits.
 */
async function waitFor(url: string, server: Promise<number>, timeoutMs = 60_000): Promise<void> {
  const state = { exited: false };
  void server.then(() => {
    state.exited = true;
  });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (state.exited) throw new Error(`The server for ${url} stopped before it answered.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline)
      throw new Error(`${url} didn't answer within ${String(timeoutMs / 1000)} s`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function main(): Promise<number> {
  const require = createRequire(path.join(WEB_DIR, 'package.json'));
  const nextBin = require.resolve('next/dist/bin/next');
  const lhciBin = createRequire(import.meta.url).resolve('@lhci/cli/src/cli.js');

  for (const port of [WEB_PORT, API_PORT, IMAGES_PORT]) await ensurePortFree(port);
  const databaseUrl = await seedFixture(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
  console.log(`Seeded the fixture: ${FIXTURE_PATH}`);
  const images = await serveImages();

  try {
    if (!process.argv.includes('--skip-build')) {
      const build = node(nextBin, ['build'], WEB_DIR, webEnv);
      if ((await build.exited) !== 0) throw new Error('The web build failed.');
    }

    const api = node(path.join(API_DIR, 'src', 'server.ts'), [], API_DIR, apiEnv(databaseUrl));
    const web = node(nextBin, ['start', '--port', String(WEB_PORT)], WEB_DIR, webEnv);
    await waitFor(`${API_URL}/health`, api.exited);
    // The first visit renders and caches the page (ISR), so Lighthouse measures a cached one.
    await waitFor(`${WEB_URL}${FIXTURE_PATH}`, web.exited);

    if (process.argv.includes('--serve')) {
      // To look at the fixture page yourself, until Ctrl+C.
      console.log(`Serving ${WEB_URL}${FIXTURE_PATH}`);
      console.log(`and the edge cases at ${WEB_URL}${EDGE_CASE_PATH} (Ctrl+C to stop)`);
      await new Promise<void>((resolve) =>
        process.once('SIGINT', () => {
          resolve();
        }),
      );
      return 0;
    }

    const lhci = node(
      lhciBin,
      ['autorun', '--config=lighthouserc.json', `--collect.url=${WEB_URL}${FIXTURE_PATH}`],
      PACKAGE_DIR,
      {},
    );
    return await lhci.exited;
  } finally {
    for (const child of children) child.kill();
    images.close();
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  for (const child of children) child.kill();
  process.exitCode = 1;
}
