import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tripsService } from '../../modules/trips/service';
import { dispatchService } from '../../modules/dispatch/service';
import { DomainError } from '../../shared/errors';

const CancelBody = z.object({ reasonCode: z.string().min(1).default('driver_cancelled') });

export async function routes(app: FastifyInstance) {
  // GET /api/v1/driver/trips/active — crash recovery
  app.get('/active', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const data = await tripsService.getDriverActiveTrip(req.user.id);
    return { ok: true, data: data ?? null };
  });

  // GET /api/v1/driver/trips/:id/route — recorded GPS breadcrumbs for route replay
  app.get<{ Params: { id: string } }>('/:id/route', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      const data = await tripsService.getTripRoute(req.params.id, req.user.id);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /api/v1/driver/trips/:id/accept
  app.post<{ Params: { id: string } }>('/:id/accept', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      const trip = await tripsService.driverAcceptTrip(req.user.id, req.params.id);
      return { ok: true, data: { tripId: trip.id, status: trip.status, riderId: trip.riderId } };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /api/v1/driver/trips/:id/decline
  app.post<{ Params: { id: string } }>('/:id/decline', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    await dispatchService.handleDriverDecline(req.user.id, req.params.id);
    await tripsService.driverDeclineTrip(req.user.id, req.params.id);
    return { ok: true };
  });

  // POST /api/v1/driver/trips/:id/arrived
  app.post<{ Params: { id: string } }>('/:id/arrived', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      const result = await tripsService.driverArrived(req.user.id, req.params.id);
      return { ok: true, data: result };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /api/v1/driver/trips/:id/start
  app.post<{ Params: { id: string } }>('/:id/start', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      const result = await tripsService.driverStartTrip(req.user.id, req.params.id);
      return { ok: true, data: result };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /api/v1/driver/trips/:id/complete
  app.post<{ Params: { id: string } }>('/:id/complete', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      const result = await tripsService.driverCompleteTrip(req.user.id, req.params.id);
      return { ok: true, data: result };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // POST /api/v1/driver/trips/:id/cancel
  app.post<{ Params: { id: string } }>('/:id/cancel', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = CancelBody.parse(req.body ?? {});
    try {
      const result = await tripsService.driverCancelTrip(req.user.id, req.params.id, body.reasonCode);
      return { ok: true, data: result };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
