import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  getOrProvisionRiderMe,
  patchRiderMe,
  type RiderMePatch,
} from '../../modules/identity/service';

const PatchBody = z.object({
  fullName: z.string().min(1).max(100).optional(),
  locale: z.enum(['en', 'ms', 'zh', 'ta']).optional(),
});

export async function routes(app: FastifyInstance) {
  app.get('/auth/me', async (req, reply) => {
    if (!req.clerkAuth) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const me = await getOrProvisionRiderMe(req.clerkAuth);
    return me;
  });

  app.patch('/auth/me', async (req, reply) => {
    if (!req.user) {
      // No row exists yet — caller must hit GET /me first to JIT-provision.
      return reply.code(404).send({ error: 'profile_not_provisioned' });
    }
    const patch = PatchBody.parse(req.body) satisfies RiderMePatch;
    await patchRiderMe(req.user.id, patch);
    return { ok: true };
  });
}
