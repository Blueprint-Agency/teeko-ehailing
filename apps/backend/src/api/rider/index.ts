import type { FastifyInstance } from 'fastify';
import { clerkAuthVerify } from '../../http/middleware/auth';
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
  app.addHook('preHandler', clerkAuthVerify);

  // Auth route runs without requireRole — it JIT-provisions the row that
  // requireRole will check on every other rider route.
  await app.register(auth);

  // Everything else: scoped sub-instance with requireRole('rider').
  await app.register(async (scope) => {
    scope.addHook('preHandler', requireRole('rider'));
    await scope.register(profile);
    await scope.register(trips, { prefix: '/trips' });
    await scope.register(pricing, { prefix: '/quotes' });
    await scope.register(maps);
    await scope.register(ratings, { prefix: '/ratings' });
    await scope.register(safety);
    await scope.register(chat);
    await scope.register(notifications, { prefix: '/notifications' });
  });
}
