import type { FastifyInstance } from 'fastify';
import { payoutsService } from '../../modules/payouts/service';

export async function routes(app: FastifyInstance) {
  // Earnings dashboard — lifetime + today totals, recent trips, payout history.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return payoutsService.getEarnings(req.user.id);
  });

  // Instant cashout of the available Connect balance (spec §12.3).
  app.post('/cashout', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return payoutsService.requestCashout(req.user.id);
  });
}
