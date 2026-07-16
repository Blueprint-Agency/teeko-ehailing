import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { disputesService } from '../../modules/disputes/service';
import { DomainError } from '../../shared/errors';

const CreateBody = z.object({
  tripId: z.string().min(1),
  category: z.enum(['overcharge', 'payment', 'service', 'safety', 'lost_item', 'other']),
  amountMyr: z.number().nonnegative().optional(),
  description: z.string().min(1).max(2000),
});

const ListQuery = z.object({ tripId: z.string().min(1) });

export async function routes(app: FastifyInstance) {
  // POST /api/v1/rider/disputes — rider raises a dispute on a finished trip.
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = CreateBody.parse(req.body);
    try {
      const dispute = await disputesService.create(req.user.id, body);
      return reply.code(201).send(dispute);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // GET /api/v1/rider/disputes?tripId= — disputes the rider raised on a trip.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const { tripId } = ListQuery.parse(req.query);
    try {
      return await disputesService.listForTrip(req.user.id, tripId);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
