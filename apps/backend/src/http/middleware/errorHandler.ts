import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import Stripe from 'stripe';
import { isStripeCardError, isStripeTestMode } from '../../external/stripe';

/**
 * Stripe failures split into two buckets:
 *
 *  - **Card declines** — a real user-facing outcome. 402, message passed through.
 *  - **Everything else** — bad params, a platform feature we haven't enabled,
 *    auth, rate limits. These are integration faults on our side, but the SDK
 *    error carries `statusCode: 400`, so Fastify used to relay them as an
 *    ordinary client error with Stripe's raw prose as the message.
 *
 * Mapping them here lets the apps tell "your card was declined" (show it) from
 * "Teeko is misconfigured" (show a support ref, log the detail). Stripe's own
 * message is surfaced in test mode only — in live mode it can name internal
 * config, so clients get the request id instead and the log keeps the rest.
 */
function stripeReply(err: Stripe.errors.StripeError, req: FastifyRequest, reply: FastifyReply) {
  req.log.error(
    {
      err,
      stripeType: err.type,
      stripeCode: err.code,
      stripeRequestId: err.requestId,
      stripeStatus: err.statusCode,
    },
    'stripe request failed',
  );

  if (err.type === 'StripeCardError') {
    return reply.code(402).send({
      error: err.decline_code ?? err.code ?? 'card_declined',
      message: err.message,
      providerRequestId: err.requestId ?? null,
    });
  }

  const transient =
    err.type === 'StripeConnectionError' || err.type === 'StripeAPIError';
  const status = err.type === 'StripeRateLimitError' ? 429 : transient ? 503 : 502;
  const code =
    err.type === 'StripeRateLimitError'
      ? 'payment_provider_rate_limited'
      : transient
        ? 'payment_provider_unavailable'
        : 'payment_provider_error';

  return reply.code(status).send({
    error: code,
    message: isStripeTestMode
      ? err.message
      : 'The payment provider rejected this request. Please try again or contact support.',
    providerRequestId: err.requestId ?? null,
  });
}

export function errorHandler(
  err: FastifyError,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: 'validation_failed', issues: err.issues });
  }
  if (err instanceof Stripe.errors.StripeError) {
    return stripeReply(err, req, reply);
  }
  // The mock gateway's decline error — same contract as a real card decline.
  if (isStripeCardError(err)) {
    req.log.warn({ err }, 'mock stripe card declined');
    return reply.code(402).send({ error: err.decline_code, message: err.message });
  }
  req.log.error({ err }, 'unhandled error');
  const status = err.statusCode ?? 500;
  return reply.code(status).send({
    error: err.code ?? 'internal_error',
    message: status === 500 ? 'internal server error' : err.message,
  });
}
