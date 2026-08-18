import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supportService } from '../../modules/support/service';
import { DomainError } from '../../shared/errors';

const CreateBody = z.object({
  subject: z.string().min(1).max(200),
  category: z.enum([
    'technical',
    'complaint',
    'payment',
    'billing',
    'account',
    'documents',
    'safety',
    'other',
  ]),
  description: z.string().min(1).max(2000),
  // Optional trip the ticket references — this is general support, not a dispute.
  tripId: z.string().min(1).optional(),
});

export async function routes(app: FastifyInstance) {
  // POST /api/v1/rider/support — rider raises a general support ticket.
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = CreateBody.parse(req.body);
    try {
      const ticket = await supportService.create(req.user.id, body);
      return reply.code(201).send(ticket);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // GET /api/v1/rider/support — every support ticket the rider has raised.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      return await supportService.listForRider(req.user.id);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
