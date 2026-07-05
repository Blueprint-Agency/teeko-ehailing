import type { FastifyInstance } from 'fastify';
import { driverClerkAuthVerify } from '../../http/middleware/auth';
import { requireRole } from '../../http/middleware/requireRole';

import { routes as auth } from './auth.routes';
import { routes as profile } from './profile.routes';
import { routes as status } from './status.routes';
import { routes as trips } from './trips.routes';
import { routes as earnings } from './earnings.routes';
import { routes as connect } from './connect.routes';
import { routes as incentives } from './incentives.routes';
import { routes as ratings } from './ratings.routes';
import { routes as safety } from './safety.routes';
import { routes as chat } from './chat.routes';
import { routes as notifications } from './notifications.routes';
import { routes as support } from './support.routes';
import { routes as maps } from './maps.routes';

export async function driverRoutes(app: FastifyInstance) {
  app.addHook('preHandler', driverClerkAuthVerify);

  // Auth runs without requireRole — it JIT-provisions the row that
  // requireRole will check on every other driver route.
  await app.register(auth);

  await app.register(async (scope) => {
    scope.addHook('preHandler', requireRole('driver'));
    await scope.register(profile);
    await scope.register(status, { prefix: '/status' });
    await scope.register(trips, { prefix: '/trips' });
    await scope.register(earnings, { prefix: '/earnings' });
    await scope.register(connect, { prefix: '/connect' });
    await scope.register(incentives, { prefix: '/incentives' });
    await scope.register(ratings, { prefix: '/ratings' });
    await scope.register(safety);
    await scope.register(chat);
    await scope.register(notifications, { prefix: '/notifications' });
    await scope.register(support, { prefix: '/support' });
    await scope.register(maps);
  });
}
