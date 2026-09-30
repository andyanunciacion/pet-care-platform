import type { ApiClient } from '@paw/api-client';

/** ok: API and database up · degraded: API up, database down · down: API unreachable. */
export type ApiStatus = 'ok' | 'degraded' | 'down';

export async function getApiStatus(client: ApiClient): Promise<ApiStatus> {
  try {
    const { data, error } = await client.GET('/health', {
      cache: 'no-store',
      // Don't let a hung API hold the page: give up after 3 seconds.
      signal: AbortSignal.timeout(3_000),
    });
    if (data?.status === 'ok') return 'ok';
    if (error?.checks.database === 'error') return 'degraded';
    return 'down';
  } catch {
    // Network error, timeout, or a response that isn't the API's JSON (e.g. a proxy error page).
    return 'down';
  }
}
