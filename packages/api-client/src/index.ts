import createClient from 'openapi-fetch';
import type { components, paths } from './schema.ts';

export type { components, paths };

export interface ApiClientOptions {
  /** Replaces the global fetch, e.g. to stub responses in tests. */
  fetch?: (request: Request) => Promise<Response>;
}

/**
 * A fetch-based client whose paths, parameters and responses are typed from the
 * API's OpenAPI spec: `client.GET('/health')` knows exactly what comes back.
 */
export function createApiClient(baseUrl: string, options: ApiClientOptions = {}) {
  return createClient<paths>({ baseUrl, ...options });
}

export type ApiClient = ReturnType<typeof createApiClient>;
