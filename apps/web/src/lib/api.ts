import { createApiClient } from '@paw/api-client';
import { serverEnv } from './env';

/**
 * Typed API client for Server Components. Calls go server to server, straight to API_URL.
 * Pass `headers: { cookie }` to act as the signed-in user (see admin-session.ts).
 */
export function apiClient(options: { headers?: Record<string, string> } = {}) {
  return createApiClient(serverEnv().API_URL, options);
}
