/**
 * Proxies /v1/* on the web origin to the API (ARCHITECTURE D31). Browsers then talk to
 * one site only, so the session cookie is first-party (Safari blocks it otherwise, since
 * *.vercel.app and *.up.railway.app are unrelated sites) and no CORS is needed.
 */
export function apiRewrites(apiUrl: string) {
  const origin = apiUrl.replace(/\/+$/, '');
  return [{ source: '/v1/:path*', destination: `${origin}/v1/:path*` }];
}
