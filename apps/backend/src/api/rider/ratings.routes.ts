import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tripsService } from '../../modules/trips/service';
import { DomainError } from '../../shared/errors';

const RateBody = z.object({
  tripId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function routes(app: FastifyInstance) {
  // POST /api/v1/rider/ratings — rider rates the driver after a completed trip.
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = RateBody.parse(req.body);
    try {
      return await tripsService.rateTrip(req.user.id, body.tripId, body.rating, body.comment);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
