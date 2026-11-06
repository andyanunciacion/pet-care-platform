import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sessionUserOf } from '../../authz.ts';
import {
  BranchHoursSchema,
  ExceptionParamsSchema,
  ReplaceHoursSchema,
  SetHoursExceptionSchema,
  confirmHours,
  deleteHoursException,
  getBranchHours,
  replaceWeeklyHours,
  setHoursException,
} from '../../services/branch-hours.ts';

const IdParamsSchema = z.object({ id: z.uuid() });

/**
 * A branch's hours: weekly schedule (replaced as a whole), date exceptions (set one date at
 * a time) and the hours confirmation (ARCHITECTURE D35). Registered inside the admin plugin.
 */
export const adminBranchHoursRoutes: FastifyPluginAsyncZod<{ database: Database }> = async (
  app,
  { database: { db } },
) => {
  app.get(
    '/branches/:id/hours',
    {
      schema: {
        summary: "A branch's weekly hours, upcoming exceptions and confirmation",
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 200: BranchHoursSchema },
      },
    },
    (request) => getBranchHours(db, request.params.id),
  );

  app.put(
    '/branches/:id/hours',
    {
      schema: {
        summary: 'Replace the weekly hours and the "open 24 hours" flag',
        tags: ['admin'],
        params: IdParamsSchema,
        body: ReplaceHoursSchema,
        response: { 200: BranchHoursSchema },
      },
    },
    (request) => replaceWeeklyHours(db, sessionUserOf(request).id, request.params.id, request.body),
  );

  app.put(
    '/branches/:id/hours-exceptions/:date',
    {
      schema: {
        summary: 'Set the hours of one date (a holiday, "closed today"), replacing any set before',
        tags: ['admin'],
        params: ExceptionParamsSchema,
        body: SetHoursExceptionSchema,
        response: { 200: BranchHoursSchema },
      },
    },
    (request) =>
      setHoursException(
        db,
        sessionUserOf(request).id,
        request.params.id,
        request.params.date,
        request.body,
      ),
  );

  app.delete(
    '/branches/:id/hours-exceptions/:date',
    {
      schema: {
        summary: 'Remove the exception on one date (the weekly hours apply again)',
        tags: ['admin'],
        params: ExceptionParamsSchema,
        response: { 200: BranchHoursSchema },
      },
    },
    (request) =>
      deleteHoursException(db, sessionUserOf(request).id, request.params.id, request.params.date),
  );

  app.post(
    '/branches/:id/hours/confirm',
    {
      schema: {
        summary: 'Confirm the hours are still correct (by PAW ops)',
        tags: ['admin'],
        params: IdParamsSchema,
        response: { 200: BranchHoursSchema },
      },
    },
    (request) => confirmHours(db, sessionUserOf(request).id, request.params.id),
  );
};
