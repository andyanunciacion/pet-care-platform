import { createApiClient } from '@paw/api-client';

/**
 * Typed API client for Client Components. It calls /v1/… on the page's own origin, which
 * Next rewrites to the API (ARCHITECTURE D31), so the browser sends the session cookie
 * itself and needs no CORS. Use it for reads that follow user input (e.g. the PSGC
 * pickers); writes go through Server Actions.
 */
export const browserApi = createApiClient('');
