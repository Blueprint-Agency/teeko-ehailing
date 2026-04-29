import type { FastifyInstance } from 'fastify';
import { auth0Verify } from '../../http/middleware/auth';
import { requireRole } from '../../http/middleware/requireRole';

import { routes as account } from './account.routes';
import { routes as agreement } from './agreement.routes';
import { routes as application } from './application.routes';
import { routes as documents } from './documents.routes';
import { routes as vehicles } from './vehicles.routes';
import { routes as notifications } from './notifications.routes';
import { routes as status } from './status.routes';

export async function driverWebRoutes(app: FastifyInstance) {
  app.addHook('preHandler', auth0Verify);
  app.addHook('preHandler', requireRole('driver'));

  await app.register(account, { prefix: '/account' });
  await app.register(agreement, { prefix: '/agreement' });
  await app.register(application, { prefix: '/application' });
  await app.register(documents, { prefix: '/documents' });
  await app.register(vehicles, { prefix: '/vehicles' });
  await app.register(notifications, { prefix: '/notifications' });
  await app.register(status, { prefix: '/status' });
}
