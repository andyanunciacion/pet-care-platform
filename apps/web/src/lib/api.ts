import { createApiClient } from '@paw/api-client';
import { serverEnv } from './env';

/** Typed API client for Server Components. */
export function apiClient() {
  return createApiClient(serverEnv().API_URL);
}
