import { z } from 'zod';

// The two Better Auth calls the browser makes, as plain fetches to /v1/auth/* on this
// origin (proxied to the API, ARCHITECTURE D31). Same-origin, so the browser sends and
// stores the session cookie itself; JavaScript never sees it (it's HttpOnly).

const SignInResponseSchema = z.object({ url: z.url() });

/**
 * Starts Google sign-in: Better Auth answers with Google's consent URL, and Google later
 * sends the browser back to /v1/auth/callback/google, which sets the session cookie and
 * redirects to `next` (or to /login?error=… if it failed).
 */
export async function startGoogleSignIn(next: string): Promise<void> {
  const response = await fetch('/v1/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'google', callbackURL: next, errorCallbackURL: '/login' }),
  });
  const body: unknown = response.ok ? await response.json() : undefined;
  const { url } = SignInResponseSchema.parse(body);
  window.location.assign(url);
}

/** Ends the session (deletes it in the API and clears the cookie). */
export async function signOut(): Promise<void> {
  const response = await fetch('/v1/auth/sign-out', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`Sign-out failed: ${String(response.status)}`);
}
