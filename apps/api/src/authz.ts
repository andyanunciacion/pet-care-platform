import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Auth, PlatformRole } from './auth.ts';
import { httpError } from './errors.ts';

/** The signed-in user, as route handlers see it. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
}

declare module 'fastify' {
  interface FastifyInstance {
    auth: Auth;
  }
  interface FastifyRequest {
    /** Set by requirePlatformRole(); null on routes without it. */
    sessionUser: SessionUser | null;
  }
}

/** Reads the session cookie and returns its user, or null if there's no valid session. */
export async function getSessionUser(
  auth: Auth,
  request: FastifyRequest,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (session === null) return null;
  const { id, name, email, platformRole } = session.user;
  return { id, name, email, platformRole };
}

/**
 * A preHandler that lets a request through only for a signed-in user with this platform
 * role: 401 without a valid session, 403 with the wrong role. Authorization lives here in
 * the API (CLAUDE.md), whatever the web app shows.
 */
export function requirePlatformRole(role: PlatformRole): preHandlerAsyncHookHandler {
  return async function (request) {
    const user = await getSessionUser(this.auth, request);
    if (user === null) throw httpError(401, 'Sign in to continue.');
    if (user.platformRole !== role) throw httpError(403, 'You do not have access to this.');
    request.sessionUser = user;
  };
}
