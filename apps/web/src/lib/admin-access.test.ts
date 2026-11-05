import { createApiClient } from '@paw/api-client';
import { describe, expect, it } from 'vitest';
import { checkAdminAccess } from './admin-access';

const admin = {
  id: '01900000-0000-7000-8000-000000000000',
  name: 'Ops',
  email: 'ops@example.test',
  platformRole: 'super_admin',
} as const;

// A client whose "network" is a stub that records what it was sent.
function clientAnswering(status: number, body: unknown) {
  const sent: Request[] = [];
  const client = createApiClient('http://api.test', {
    headers: { cookie: 'better-auth.session_token=abc.def' },
    fetch: (request) => {
      sent.push(request);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  });
  return { client, sent };
}

describe('checkAdminAccess', () => {
  it('returns the admin for a super admin session', async () => {
    const { client } = clientAnswering(200, admin);
    expect(await checkAdminAccess(client)).toEqual({ status: 'ok', admin });
  });

  it('is signed_out on 401', async () => {
    const { client } = clientAnswering(401, { status: 401, title: 'Unauthorized' });
    expect(await checkAdminAccess(client)).toEqual({ status: 'signed_out' });
  });

  it('is forbidden on 403', async () => {
    const { client } = clientAnswering(403, { status: 403, title: 'Forbidden' });
    expect(await checkAdminAccess(client)).toEqual({ status: 'forbidden' });
  });

  it('throws on anything else, so an outage never looks like "signed out"', async () => {
    const { client } = clientAnswering(500, { status: 500 });
    await expect(checkAdminAccess(client)).rejects.toThrow(/500/);
  });

  it("forwards the user's cookie to the API", async () => {
    const { client, sent } = clientAnswering(200, admin);
    await checkAdminAccess(client);
    expect(sent[0]?.url).toBe('http://api.test/v1/admin/me');
    expect(sent[0]?.headers.get('cookie')).toBe('better-auth.session_token=abc.def');
  });
});
