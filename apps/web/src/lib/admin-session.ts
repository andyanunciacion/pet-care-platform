import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { checkAdminAccess, type AdminUser } from './admin-access';
import { apiClient } from './api';

/**
 * The /admin guard (Next.js "data access layer" pattern). Call it at the top of the admin
 * layout AND every admin page: layouts don't re-render on client-side navigation, so a
 * layout-only check would be skipped. React's cache() makes repeat calls in one request
 * hit the API once.
 *
 * This is for the user experience only. The API checks the role again on every admin call.
 */
export const requireAdmin = cache(async (): Promise<AdminUser> => {
  // Forward the browser's cookies so the API sees the session (server to server).
  const cookie = (await headers()).get('cookie') ?? '';
  const access = await checkAdminAccess(apiClient({ headers: { cookie } }));

  if (access.status === 'signed_out') redirect('/login?next=/admin');
  if (access.status === 'forbidden') redirect('/login?error=no_access');
  return access.admin;
});
