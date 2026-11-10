import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { apiClient } from './api';

/**
 * The typed API client, acting as the signed-in user: forwards the browser's cookies to the
 * API (server to server). For admin pages and Server Actions; the API checks the role on
 * every call.
 */
export async function adminApi() {
  const cookie = (await headers()).get('cookie') ?? '';
  return apiClient({ headers: { cookie } });
}

/**
 * The response data, or Next's 404 page when the record doesn't exist. A malformed id in
 * the URL (the API answers 400) is also "not found" from the visitor's point of view.
 */
export function dataOrNotFound<T>(result: { data?: T; response: Response }): T {
  if (result.data !== undefined) return result.data;
  if (result.response.status === 404 || result.response.status === 400) notFound();
  throw new Error(`Unexpected response from the API: ${String(result.response.status)}`);
}

/**
 * For the image routes: the data, or null when photo storage isn't set up on the API (503),
 * so the page can say so instead of failing. Otherwise like dataOrNotFound.
 */
export function dataOrStorageOff<T>(result: { data?: T; response: Response }): T | null {
  if (result.data === undefined && result.response.status === 503) return null;
  return dataOrNotFound(result);
}

/** The response data; anything else is an outage, so the error page shows. */
export function dataOrThrow<T>(result: { data?: T; response: Response }): T {
  if (result.data !== undefined) return result.data;
  throw new Error(`Unexpected response from the API: ${String(result.response.status)}`);
}
