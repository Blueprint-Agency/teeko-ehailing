import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { stripe, type StripeEvent } from '../../external/stripe';
import { paymentsService } from '../../modules/payments/service';
import { routes as clerk } from './clerk.routes';

export async function webhookRoutes(app: FastifyInstance) {
  await app.register(clerk);

  // Stripe webhook (spec §14). Single signature-verified endpoint; the handler
  // is idempotent (webhook_events dedup + unique indexes), so Stripe re-delivery
  // is safe. A thrown handler → 500 → Stripe retries.
  //
  // Real HMAC verification needs the EXACT raw request body — a re-serialized
  // JSON.stringify(parsed) won't byte-match the signed payload. We register a
  // raw-body content-type parser scoped to this child plugin (so it doesn't
  // affect /tng, /auth0, or the clerk routes) and pass the raw string to
  // constructEvent. The mock gateway just JSON.parses that same raw string.
  await app.register(async (stripeApp) => {
    stripeApp.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_req, body, done) => {
        try {
          done(null, { raw: body as string, parsed: JSON.parse(body as string) });
        } catch (err) {
          done(err as Error);
        }
      },
    );

    stripeApp.post('/stripe', async (req, reply) => {
      const sig = (req.headers['stripe-signature'] as string) ?? '';
      const body = req.body as { raw: string; parsed: unknown };
      let event: StripeEvent;
      try {
        event = stripe.webhooks.constructEvent(
          body.raw,
          sig,
          env.STRIPE_WEBHOOK_SECRET ?? '',
        );
      } catch (err) {
        logger.warn({ err }, 'stripe webhook signature verification failed');
        return reply.code(400).send({ ok: false, error: { code: 'BAD_SIGNATURE' } });
      }
      await paymentsService.handleStripeEvent(event);
      return reply.code(200).send({ received: true });
    });
  });

  // Other providers — still stubs until wired.
  app.post('/tng', async () => ({ stub: 'tng webhook' }));
  app.post('/auth0', async () => ({ stub: 'auth0 hooks (post-registration)' }));
}
