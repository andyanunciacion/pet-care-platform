import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** RFC 9457 "problem details": the body of every error response. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  /** Validation errors only: which inputs were wrong and why. */
  errors?: { location: string; pointer: string; message: string }[];
}

function problem(status: number, detail?: string): Problem {
  return {
    // "about:blank" means the HTTP status says it all; the title is the status text.
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    ...(detail !== undefined && { detail }),
  };
}

function sendProblem(reply: FastifyReply, body: Problem): FastifyReply {
  return reply.status(body.status).type('application/problem+json').send(body);
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return sendProblem(reply, {
      ...problem(400, 'The request is invalid.'),
      errors: error.validation.map((issue) => ({
        location: error.validationContext ?? 'request',
        pointer: issue.instancePath,
        message: issue.message ?? 'Invalid value',
      })),
    });
  }

  const status = error.statusCode ?? 500;
  if (status < 400 || status >= 500) {
    // Log the real cause, but never send internals to the client.
    request.log.error({ err: error }, 'request failed');
    return sendProblem(reply, problem(500));
  }
  return sendProblem(reply, problem(status, error.message));
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return sendProblem(
    reply,
    problem(404, `No route for ${request.method} ${request.url.split('?')[0] ?? ''}`),
  );
}
