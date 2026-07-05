import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paymentsService } from '../../modules/payments/service';

const AddBody = z.object({
  type: z.enum(['cash', 'card', 'tng', 'google_pay']),
  // Device-tokenized: pm_xxx (card/google_pay) or a TNG agreement id. Omitted for cash.
  token: z.string().min(1).optional(),
});

export async function routes(app: FastifyInstance) {
  // List the rider's saved methods.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return paymentsService.listMethods(req.user.id);
  });

  // Add a method (§7). Tokenization already happened on-device.
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = AddBody.parse(req.body);
    return paymentsService.addMethod(req.user.id, body.type, body.token ?? null);
  });

  // Set default — PUT per spec; POST kept for the current rider app.
  app.put<{ Params: { id: string } }>('/:id/default', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return paymentsService.setDefault(req.user.id, req.params.id);
  });
  app.post<{ Params: { id: string } }>('/:id/default', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return paymentsService.setDefault(req.user.id, req.params.id);
  });

  // Detach + soft-delete (§7).
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    await paymentsService.deleteMethod(req.user.id, req.params.id);
    return reply.code(204).send();
  });
}
