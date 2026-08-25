import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { driversService } from '../../modules/drivers/service';
import {
  cancelProfileChange,
  getFieldStates,
  listDriverRequests,
  submitProfileChange,
  type ProfileChangeField,
  type SubmitResult,
} from '../../modules/drivers/profile-changes';
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
      const [profile, fields] = await Promise.all([
        driversService.getProfile(req.user.id),
        getFieldStates(req.user.id),
      ]);
      return { profile, fields };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply
          .code(err.statusCode)
          .send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // PATCH /api/v1/driver/profile — the driver *requests* a change to their own
  // name or phone. Nothing is written to the account here: each field raises a
  // pending request that an admin has to approve, and each field may only
  // change once every 30 days. Everything else on the profile (licence,
  // vehicle, approval status) is verified evidence and never self-service.
  //
  // Always 200: a two-field edit can legitimately half-succeed (name accepted,
  // phone still inside its cooldown), so the per-field outcome is the payload
  // rather than the status code.
  app.patch('/profile', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const patch = PatchBody.parse(req.body);

    const wanted: Array<{ field: ProfileChangeField; value: string }> = [];
    if (patch.fullName !== undefined) wanted.push({ field: 'full_name', value: patch.fullName });
    if (patch.phone !== undefined) wanted.push({ field: 'phone', value: patch.phone });

    const results: Array<{ field: ProfileChangeField } & SubmitResult> = [];
    for (const w of wanted) {
      const result = await submitProfileChange({
        driverId: req.user.id,
        field: w.field,
        value: w.value,
      });
      results.push({ field: w.field, ...result });
    }

    const [profile, fields] = await Promise.all([
      driversService.getProfile(req.user.id),
      getFieldStates(req.user.id),
    ]);
    return { profile, fields, results };
  });

  // GET /api/v1/driver/profile/changes — full history, newest first. The
  // per-field summary the edit screen needs comes back on GET /profile.
  app.get('/profile/changes', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return { requests: await listDriverRequests(req.user.id) };
  });

  // DELETE /api/v1/driver/profile/changes/:id — withdraw a request that is
  // still waiting on review. Cancelling costs nothing: the cooldown only ever
  // starts when a change is actually applied.
  app.delete<{ Params: { id: string } }>('/profile/changes/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const outcome = await cancelProfileChange(req.user.id, req.params.id);
    if (outcome === 'not_found') {
      return reply.code(404).send({ error: 'request_not_found_or_already_reviewed' });
    }
    return { ok: true, fields: await getFieldStates(req.user.id) };
  });
}
