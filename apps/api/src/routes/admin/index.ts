import type { Database } from '@paw/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PLATFORM_ROLES } from '../../auth.ts';
import { requirePlatformRole, sessionUserOf } from '../../authz.ts';
import { adminBranchHoursRoutes } from './branch-hours.ts';
import { adminBranchServiceRoutes } from './branch-services.ts';
import { adminBranchRoutes } from './branches.ts';
import type { PhotoStorage } from '../../storage.ts';
import { adminBusinessRoutes } from './businesses.ts';
import { adminMediaRoutes } from './media.ts';
import { adminProductRoutes } from './products.ts';
import { adminReferenceRoutes } from './reference.ts';

const AdminMeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  platformRole: z.enum(PLATFORM_ROLES),
});

/**
 * PAW ops routes (/v1/admin/*). The hook below runs before EVERY route registered in this
 * plugin, including the child plugins registered after it (Fastify encapsulation: hooks
 * added inside a plugin apply to that plugin and its children, never to its siblings), so a
 * new admin route is protected without remembering to add a check.
 */
export const adminRoutes: FastifyPluginAsyncZod<{
  database: Database;
  /** Photo storage, or null when it isn't configured (the media routes then answer 503). */
  storage: PhotoStorage | null;
}> = async (app, { database, storage }) => {
  app.addHook('onRequest', requirePlatformRole('super_admin'));

  app.get(
    '/me',
    {
      schema: {
        summary: 'The signed-in PAW ops user',
        tags: ['admin'],
        response: { 200: AdminMeSchema },
      },
    },
    (request) => sessionUserOf(request),
  );

  await app.register(adminBusinessRoutes, { database });
  await app.register(adminBranchRoutes, { database });
  await app.register(adminBranchHoursRoutes, { database });
  await app.register(adminBranchServiceRoutes, { database });
  await app.register(adminProductRoutes, { database });
  await app.register(adminMediaRoutes, { database, storage });
  await app.register(adminReferenceRoutes, { database });
};
