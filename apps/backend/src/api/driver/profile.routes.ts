import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { isUniqueViolation } from '../../db/errors';
import { driversService } from '../../modules/drivers/service';
import { patchDriverMe, type DriverMePatch } from '../../modules/identity/service';
import { DomainError } from '../../shared/errors';

// Loose on input, normalised in the service — same rule as the rider PATCH.
const PatchBody = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^[+0-9\s\-()]*$/, 'invalid phone number')
    .optional(),
});

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

  // PATCH /api/v1/driver/profile — the driver edits their own name and phone.
  // Everything else on the profile (licence, vehicle, approval status) is
  // verified data and only changes through the web portal / admin review.
  app.patch('/profile', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const patch = PatchBody.parse(req.body) satisfies DriverMePatch;
    try {
      await patchDriverMe(req.user.id, patch);
    } catch (err) {
      if (isUniqueViolation(err)) return reply.code(409).send({ error: 'phone_taken' });
      throw err;
    }
    return { profile: await driversService.getProfile(req.user.id) };
  });
}
