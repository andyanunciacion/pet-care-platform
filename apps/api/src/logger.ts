import type { FastifyServerOptions } from 'fastify';
import type { Env } from './env.ts';

/**
 * What gets logged about each request. Deliberately minimal: no IP address, headers,
 * body or query string, because those can carry personal data (search terms, phone
 * numbers, cookies). Fastify's default would log the client IP.
 */
export function serializeRequest(request: { method: string; url: string }): {
  method: string;
  path: string;
} {
  return { method: request.method, path: request.url.split('?')[0] ?? '' };
}

export function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    serializers: { req: serializeRequest },
    // Human-readable logs locally; structured JSON everywhere else.
    ...(env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
  };
}
