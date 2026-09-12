import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { disputesService } from '../../modules/disputes/service';
import { DomainError } from '../../shared/errors';

// Categories a driver can file under. `overcharge` and `payment` cover fare and
// payout money issues; `document` and `account` are driver-only and carry no
// trip. Riders keep their own (service / safety / lost_item) set.
const DriverCategory = z.enum(['overcharge', 'payment', 'document', 'account', 'other']);

const CreateBody = z.object({
  // Optional: an account or document report isn't tied to a trip.
  tripId: z.string().uuid().nullish(),
  category: DriverCategory,
  amountMyr: z.number().nonnegative().optional(),
  description: z.string().min(1).max(2000),
});

function sendDomainError(reply: FastifyReply, err: unknown) {
  if (err instanceof DomainError) {
    return reply
      .code(err.statusCode)
      .send({ ok: false, error: { code: err.code, message: err.message } });
  }
  throw err;
}

export async function routes(app: FastifyInstance) {
  // POST /api/v1/driver/disputes — driver files a report from Support.
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = CreateBody.parse(req.body);
    try {
      const dispute = await disputesService.createForDriver(req.user.id, body);
      return reply.code(201).send(dispute);
    } catch (err) {
      return sendDomainError(reply, err);
    }
  });

  // GET /api/v1/driver/disputes — every report this driver has filed.
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      return await disputesService.listForDriver(req.user.id);
    } catch (err) {
      return sendDomainError(reply, err);
    }
  });
}
