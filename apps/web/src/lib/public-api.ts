import { createApiClient } from '@paw/api-client';
import { revalidatePath, updateTag } from 'next/cache';
import { serverEnv } from './env';

/**
 * Cache tag on every public listing read. One tag for all listings (ARCHITECTURE D41):
 * several admin actions only know a child id (service, product, photo), and edits are rare,
 * so invalidating everything is simplest; pages regenerate one by one as they're visited.
 */
const LISTINGS_TAG = 'listings';

/**
 * The typed API client for public pages. Responses go into Next's data cache under the
 * listings tag, so a page is rendered once and then served from the cache (ISR) until an
 * edit invalidates it. openapi-fetch passes a Request to fetch, which ignores a `next`
 * option given per call, hence the wrapped fetch here.
 */
export function publicApi() {
  return createApiClient(serverEnv().API_URL, {
    fetch: (request) => fetch(request, { cache: 'force-cache', next: { tags: [LISTINGS_TAG] } }),
  });
}

/** The public listing routes, as route patterns (every page each one renders). */
const LISTING_ROUTES = [
  '/(public)/[province]/[city]/[business]',
  '/(public)/[province]/[city]/[business]/[branch]',
] as const;

/**
 * Call after every successful admin write (Server Actions only): the public pages show the
 * change on their next load instead of serving the old version first. The tag expires the
 * cached API responses; the paths also expire cached "not found" pages (a hidden listing
 * that was just published), since Next only caches successful responses, so a 404 page
 * carries no tag.
 */
export function refreshListings(): void {
  updateTag(LISTINGS_TAG);
  for (const route of LISTING_ROUTES) revalidatePath(route, 'page');
}
