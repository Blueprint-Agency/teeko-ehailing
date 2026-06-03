import type { FastifyInstance } from 'fastify';
import { getOrProvisionDriverMe } from '../../modules/identity/service';

export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver/auth/me
  // JIT-provisions the driver row on first call after Clerk signup.
  app.get('/auth/me', async (req, reply) => {
    if (!req.clerkAuth) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const me = await getOrProvisionDriverMe(req.clerkAuth);
    return me;
  });
}
