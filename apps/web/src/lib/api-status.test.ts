import { createApiClient } from '@paw/api-client';
import { describe, expect, it } from 'vitest';
import { getApiStatus } from './api-status';

// A client whose "network" is a stub, so each API outcome can be simulated.
function clientAnswering(respond: () => Promise<Response>) {
  return createApiClient('http://api.test', { fetch: respond });
}

const json = (body: unknown, status: number) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );

describe('getApiStatus', () => {
  it('is ok when the API and database are up', async () => {
    const client = clientAnswering(() => json({ status: 'ok', checks: { database: 'ok' } }, 200));
    expect(await getApiStatus(client)).toBe('ok');
  });

  it('is degraded when the API is up but the database is not', async () => {
    const client = clientAnswering(() =>
      json({ status: 'error', checks: { database: 'error' } }, 503),
    );
    expect(await getApiStatus(client)).toBe('degraded');
  });

  it('is down when the API cannot be reached', async () => {
    const client = clientAnswering(() => Promise.reject(new TypeError('fetch failed')));
    expect(await getApiStatus(client)).toBe('down');
  });

  it('is down when something other than the API answers', async () => {
    const client = clientAnswering(() =>
      Promise.resolve(new Response('<h1>Bad gateway</h1>', { status: 502 })),
    );
    expect(await getApiStatus(client)).toBe('down');
  });
});
