import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { MapsError, mapsService } from '../../modules/maps';

const DirectionsBody = z.object({
  origin: z.object({ lat: z.number().gte(-90).lte(90), lng: z.number().gte(-180).lte(180) }),
  destination: z.object({ lat: z.number().gte(-90).lte(90), lng: z.number().gte(-180).lte(180) }),
  mode: z.enum(['driving', 'walking', 'bicycling', 'transit']).optional().default('driving'),
  departureTime: z.union([z.number().int().positive(), z.literal('now')]).optional(),
});

export async function routes(app: FastifyInstance) {
  app.post('/directions', async (req, reply) => {
    const input = DirectionsBody.parse(req.body);
    try {
      return await mapsService.directions(input);
    } catch (err) {
      if (err instanceof MapsError) {
        return reply.code(err.statusCode).send({ error: 'directions_unavailable' });
      }
      throw err;
    }
  });
}
