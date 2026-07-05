import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paymentsService } from '../../modules/payments/service';
import { syncTripPayment } from '../../jobs/reconcile.worker';

// Admin refund console (spec §10 / §18): search a trip → view its payments +
// refunds → issue a refund with a reason and the reverse-transfer toggle.
export async function routes(app: FastifyInstance) {
  // All payments (+ their refunds) for a trip.
  app.get<{ Params: { tripId: string } }>('/trip/:tripId', async (req) => {
    return paymentsService.adminGetTripPayments(req.params.tripId);
  });

  // Single payment detail.
  app.get<{ Params: { id: string } }>('/:id', async (req) => {
    return paymentsService.adminGetPayment(req.params.id);
  });

  // Issue a refund. `reverseTransfer=true` claws the driver's cut back
  // (driver at fault); false = Teeko absorbs it (goodwill / platform error).
  const RefundBody = z.object({
    amountCents: z.number().int().positive().optional(), // omit = full refund
    reason: z.enum(['rider_complaint', 'driver_fault', 'overcharge', 'duplicate']),
    reverseTransfer: z.boolean().default(false),
  });
  app.post<{ Params: { id: string } }>('/:id/refund', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = RefundBody.parse(req.body);
    return paymentsService.issueRefund(req.params.id, {
      amountCents: body.amountCents,
      reason: body.reason,
      reverseTransfer: body.reverseTransfer,
      by: req.user.id,
    });
  });

  // Idempotent on-demand recovery when a webhook is delayed (spec §15).
  app.post<{ Params: { tripId: string } }>('/trip/:tripId/sync', async (req) => {
    return syncTripPayment(req.params.tripId);
  });
}
