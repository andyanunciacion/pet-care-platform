import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
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
 * An onRequest hook that lets a request through only for a signed-in user with this
 * platform role: 401 without a valid session, 403 with the wrong role. Authorization lives
 * here in the API (CLAUDE.md), whatever the web app shows.
 *
 * onRequest is the first step of Fastify's request lifecycle, before the body is parsed and
 * validated, so strangers get a 401 instead of validation details about admin routes.
 */
export function requirePlatformRole(role: PlatformRole): onRequestAsyncHookHandler {
  return async function (request) {
    const user = await getSessionUser(this.auth, request);
    if (user === null) throw httpError(401, 'Sign in to continue.');
    if (user.platformRole !== role) throw httpError(403, 'You do not have access to this.');
    request.sessionUser = user;
  };
}

/** The signed-in user, on routes behind requirePlatformRole(). */
export function sessionUserOf(request: FastifyRequest): SessionUser {
  if (request.sessionUser === null) throw new Error('route is missing requirePlatformRole()');
  return request.sessionUser;
}
