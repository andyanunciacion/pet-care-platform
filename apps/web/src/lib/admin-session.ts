import { redirect } from 'next/navigation';
import { cache } from 'react';
import { checkAdminAccess, type AdminUser } from './admin-access';
import { adminApi } from './admin-api';

/**
 * The /admin guard (Next.js "data access layer" pattern). Call it at the top of the admin
 * layout, every admin page AND every admin Server Action: layouts don't re-render on
 * client-side navigation, and Server Actions can be called by a direct POST, so a
 * layout-only check would be skipped. React's cache() makes repeat calls in one request
 * hit the API once.
 *
 * This is for the user experience only. The API checks the role again on every admin call.
 */
export const requireAdmin = cache(async (): Promise<AdminUser> => {
  const access = await checkAdminAccess(await adminApi());

  if (access.status === 'signed_out') redirect('/login?next=/admin');
  if (access.status === 'forbidden') redirect('/login?error=no_access');
  return access.admin;
});
