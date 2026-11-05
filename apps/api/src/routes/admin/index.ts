import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PLATFORM_ROLES } from '../../auth.ts';
import { requirePlatformRole } from '../../authz.ts';

const AdminMeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  platformRole: z.enum(PLATFORM_ROLES),
});

/**
 * PAW ops routes (/v1/admin/*). The hook below runs before EVERY route registered in this
 * plugin, so a new admin route is protected without remembering to add a check (Fastify
 * encapsulation: hooks added inside a plugin apply only to that plugin's routes).
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', requirePlatformRole('super_admin'));

  app.get(
    '/me',
    {
      schema: {
        summary: 'The signed-in PAW ops user',
        tags: ['admin'],
        response: { 200: AdminMeSchema },
      },
    },
    (request) => {
      // The preHandler above guarantees a super admin here.
      if (request.sessionUser === null) throw new Error('admin route without a session user');
      return request.sessionUser;
    },
  );
};
