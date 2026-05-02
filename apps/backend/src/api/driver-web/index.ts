import type { FastifyInstance } from 'fastify';
import { auth0Verify } from '../../http/middleware/auth';
import { requireRole } from '../../http/middleware/requireRole';

import { routes as auth } from './auth.routes';
import { routes as account } from './account.routes';
import { routes as agreement } from './agreement.routes';
import { routes as application } from './application.routes';
import { routes as documents } from './documents.routes';
import { routes as vehicles } from './vehicles.routes';
import { routes as notifications } from './notifications.routes';
import { routes as status } from './status.routes';

export async function driverWebRoutes(app: FastifyInstance) {
  // Public routes (no auth required)
  await app.register(auth, { prefix: '/auth' });

  // Protected routes
  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', auth0Verify);
    protectedApp.addHook('preHandler', requireRole('driver'));

    await protectedApp.register(account, { prefix: '/account' });
    await protectedApp.register(agreement, { prefix: '/agreement' });
    await protectedApp.register(application, { prefix: '/application' });
    await protectedApp.register(documents, { prefix: '/documents' });
    await protectedApp.register(vehicles, { prefix: '/vehicles' });
    await protectedApp.register(notifications, { prefix: '/notifications' });
    await protectedApp.register(status, { prefix: '/status' });
  });
}
