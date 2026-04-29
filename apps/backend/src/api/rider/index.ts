import type { FastifyInstance } from 'fastify';
import { auth0Verify } from '../../http/middleware/auth';
import { requireRole } from '../../http/middleware/requireRole';

import { routes as auth } from './auth.routes';
import { routes as profile } from './profile.routes';
import { routes as trips } from './trips.routes';
import { routes as pricing } from './pricing.routes';
import { routes as maps } from './maps.routes';
import { routes as ratings } from './ratings.routes';
import { routes as safety } from './safety.routes';
import { routes as chat } from './chat.routes';
import { routes as notifications } from './notifications.routes';

export async function riderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', auth0Verify);
  app.addHook('preHandler', requireRole('rider'));

  await app.register(auth);
  await app.register(profile);
  await app.register(trips, { prefix: '/trips' });
  await app.register(pricing, { prefix: '/quotes' });
  await app.register(maps);
  await app.register(ratings, { prefix: '/ratings' });
  await app.register(safety);
  await app.register(chat);
  await app.register(notifications, { prefix: '/notifications' });
}
