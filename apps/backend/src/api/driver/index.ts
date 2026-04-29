import type { FastifyInstance } from 'fastify';
import { auth0Verify } from '../../http/middleware/auth';
import { requireRole } from '../../http/middleware/requireRole';

import { routes as auth } from './auth.routes';
import { routes as profile } from './profile.routes';
import { routes as status } from './status.routes';
import { routes as trips } from './trips.routes';
import { routes as earnings } from './earnings.routes';
import { routes as incentives } from './incentives.routes';
import { routes as ratings } from './ratings.routes';
import { routes as safety } from './safety.routes';
import { routes as chat } from './chat.routes';
import { routes as notifications } from './notifications.routes';
import { routes as support } from './support.routes';

export async function driverRoutes(app: FastifyInstance) {
  app.addHook('preHandler', auth0Verify);
  app.addHook('preHandler', requireRole('driver'));

  await app.register(auth);
  await app.register(profile);
  await app.register(status);
  await app.register(trips, { prefix: '/trips' });
  await app.register(earnings, { prefix: '/earnings' });
  await app.register(incentives, { prefix: '/incentives' });
  await app.register(ratings, { prefix: '/ratings' });
  await app.register(safety);
  await app.register(chat);
  await app.register(notifications, { prefix: '/notifications' });
  await app.register(support, { prefix: '/support' });
}
