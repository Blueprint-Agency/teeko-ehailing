import type { FastifyInstance } from 'fastify';
import { payoutsService } from '../../modules/payouts/service';

// Driver Stripe Connect onboarding (spec §12.1). Stripe collects bank + KYC;
// Teeko stores only the account id + status.
export async function routes(app: FastifyInstance) {
  // Create (or reuse) the Connect account and return a hosted onboarding URL.
  app.post('/onboard', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return payoutsService.startOnboarding(req.user.id);
  });

  // Poll onboarding status — drives the "can go online" gate.
  app.get('/status', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return payoutsService.getConnectStatus(req.user.id);
  });
}
