import type { FastifyInstance } from 'fastify';

import { driversService } from '../../modules/drivers/service';
import { DomainError } from '../../shared/errors';

export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver/profile — the driver's own profile and performance stats.
  app.get('/profile', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      return { profile: await driversService.getProfile(req.user.id) };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply
          .code(err.statusCode)
          .send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
