import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { safetyService } from '../../modules/safety/service';
import { DomainError } from '../../shared/errors';

const SosBody = z.object({
  tripId: z.string().min(1).nullish(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const IncidentBody = z.object({
  tripId: z.string().min(1).nullish(),
  reason: z.string().min(1).max(2000),
});

export async function routes(app: FastifyInstance) {
  // POST /api/v1/driver/safety/sos — driver panic button.
  app.post('/safety/sos', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = SosBody.parse(req.body);
    return safetyService.raiseSos(req.user.id, body);
  });

  // Lets the app restore the alerting state after a restart mid-incident.
  app.get('/safety/sos/active', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return { alert: await safetyService.activeSos(req.user.id) };
  });

  app.post('/safety/sos/:id/resolve', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const { id } = req.params as { id: string };
    try {
      return await safetyService.resolveSos(req.user.id, id);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply
          .code(err.statusCode)
          .send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.get('/safety/contacts', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return { contacts: await safetyService.listContacts(req.user.id) };
  });

  // Non-emergency: unsafe passenger, damage, harassment — reviewed by ops.
  app.post('/safety/incident-reports', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = IncidentBody.parse(req.body);
    try {
      return await safetyService.reportIncident(req.user.id, body);
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
