import type { FastifyPluginAsync } from 'fastify';
import { AUTH_BASE_PATH, CLIENT_IP_HEADER, type Auth } from '../auth.ts';

/**
 * Hands every /v1/auth/* request to Better Auth, which speaks the Fetch API
 * (Request → Response). These are Better Auth's own endpoints with its own JSON shapes,
 * consumed by its client in the web app, so they stay out of our OpenAPI spec.
 */
export const authRoutes: FastifyPluginAsync<{ auth: Auth; publicOrigin: string }> = async (
  app,
  { auth, publicOrigin },
) => {
  // Pass bodies through untouched (JSON or form posts) instead of letting Fastify parse
  // and us re-serialize them. Scoped to this plugin only (Fastify encapsulation).
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  app.route({
    method: ['GET', 'POST'],
    url: `${AUTH_BASE_PATH}/*`,
    schema: { hide: true },
    async handler(request, reply) {
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
      }
      // The client IP as Fastify resolved it (TRUST_PROXY_HOPS), overwriting any value
      // the client sent itself.
      headers.set(CLIENT_IP_HEADER, request.ip);

      const body = typeof request.body === 'string' && request.body !== '' ? request.body : null;
      const response = await auth.handler(
        new Request(new URL(request.url, publicOrigin), {
          method: request.method,
          headers,
          body: request.method === 'GET' ? null : body,
        }),
      );

      reply.status(response.status);
      response.headers.forEach((value, name) => {
        if (name !== 'set-cookie') void reply.header(name, value);
      });
      // Several cookies can be set at once; Headers.forEach would merge them into one line.
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) void reply.header('set-cookie', cookies);
      return reply.send(response.body === null ? null : await response.text());
    },
  });
};
