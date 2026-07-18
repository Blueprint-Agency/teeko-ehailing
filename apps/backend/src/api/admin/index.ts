import type { FastifyInstance } from 'fastify';
import { auth0Verify } from '../../http/middleware/auth';
import { requireAdminRole } from '../../http/middleware/requireRole';

import { routes as auth } from './auth.routes';
import { routes as users } from './users.routes';
import { routes as riders } from './riders.routes';
import { routes as admins } from './admins.routes';
import { routes as drivers } from './drivers.routes';
import { routes as trips } from './trips.routes';
import { routes as payments } from './payments.routes';
import { routes as payouts } from './payouts.routes';
import { routes as broadcasts } from './broadcasts.routes';
import { routes as pdpa } from './pdpa.routes';
import { routes as metrics } from './metrics.routes';
import { routes as commissions } from './commissions.routes';
import { routes as surge } from './surge.routes';
import { routes as feedback } from './feedback.routes';
import { routes as disputes } from './disputes.routes';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', auth0Verify);
  app.addHook('preHandler', requireAdminRole());

  await app.register(auth);
  await app.register(users, { prefix: '/users' });
  await app.register(riders, { prefix: '/riders' });
  await app.register(admins, { prefix: '/admins' });
  await app.register(drivers, { prefix: '/drivers' });
  await app.register(trips, { prefix: '/trips' });
  await app.register(payments, { prefix: '/payments' });
  await app.register(payouts, { prefix: '/payouts' });
  await app.register(broadcasts, { prefix: '/broadcasts' });
  await app.register(pdpa, { prefix: '/pdpa' });
  await app.register(metrics, { prefix: '/metrics' });
  await app.register(commissions, { prefix: '/commissions' });
  await app.register(surge, { prefix: '/surge' });
  await app.register(feedback, { prefix: '/feedback' });
  await app.register(disputes, { prefix: '/disputes' });
}
