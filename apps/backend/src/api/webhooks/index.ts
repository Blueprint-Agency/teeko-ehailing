import type { FastifyInstance } from 'fastify';

import { routes as clerk } from './clerk.routes';

export async function webhookRoutes(app: FastifyInstance) {
  await app.register(clerk);

  // Existing stubs — still placeholders, not yet wired.
  app.post('/stripe', async () => ({ stub: 'stripe webhook · verify Stripe-Signature' }));
  app.post('/tng', async () => ({ stub: 'tng webhook' }));
  app.post('/grabpay', async () => ({ stub: 'grabpay webhook' }));
  app.post('/auth0', async () => ({ stub: 'auth0 hooks (post-registration)' }));
}
