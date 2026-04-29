import type { FastifyInstance } from 'fastify';

// Webhook routes are signature-verified, no JWT auth.
// Stubs for v0.1 — wire actual signature verification in v1.0.
export async function webhookRoutes(app: FastifyInstance) {
  app.post('/stripe', async () => ({ stub: 'stripe webhook · verify Stripe-Signature' }));
  app.post('/tng', async () => ({ stub: 'tng webhook' }));
  app.post('/grabpay', async () => ({ stub: 'grabpay webhook' }));
  app.post('/auth0', async () => ({ stub: 'auth0 hooks (post-registration)' }));
}
