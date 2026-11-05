import type { ApiClient, paths } from '@paw/api-client';

/** The signed-in PAW ops user, as GET /v1/admin/me returns it (typed from the API spec). */
export type AdminUser =
  paths['/v1/admin/me']['get']['responses'][200]['content']['application/json'];

export type AdminAccess =
  { status: 'ok'; admin: AdminUser } | { status: 'signed_out' } | { status: 'forbidden' };

/**
 * Asks the API whether the request's session belongs to a super admin. The API decides
 * (it enforces the same rule on every admin route); the web app only picks what to show.
 */
export async function checkAdminAccess(client: ApiClient): Promise<AdminAccess> {
  const { data, response } = await client.GET('/v1/admin/me', { cache: 'no-store' });
  if (data !== undefined) return { status: 'ok', admin: data };
  if (response.status === 401) return { status: 'signed_out' };
  if (response.status === 403) return { status: 'forbidden' };
  // Anything else (API down, 5xx) is an outage, not an auth answer: let the error page show.
  throw new Error(`Unexpected response from the API: ${String(response.status)}`);
}
