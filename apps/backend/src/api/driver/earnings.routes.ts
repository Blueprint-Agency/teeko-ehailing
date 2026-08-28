import type { FastifyInstance } from 'fastify';
import { payoutsService } from '../../modules/payouts/service';

export async function routes(app: FastifyInstance) {
  // Earnings dashboard — lifetime + today totals, recent trips, payout history.
  // Earnings are paid out to the driver's registered bank account on the payout
  // cycle, so there is no in-app cashout to expose here.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return payoutsService.getEarnings(req.user.id);
  });
}
