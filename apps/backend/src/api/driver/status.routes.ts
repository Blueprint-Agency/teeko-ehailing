import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { driverProfiles, driverRadiusSettings } from '../../db/schema';
import { redis } from '../../config/redis';
import { trackingService } from '../../modules/tracking/service';
import { DomainError } from '../../shared/errors';

const LocationBody = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  heading: z.number().gte(0).lte(360).default(0),
});

const RadiusBody = z.object({ radiusKm: z.number().min(1).max(50) });

export async function routes(app: FastifyInstance) {
  // PUT /api/v1/driver/status/online
  app.put('/online', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const driverId = req.user.id;
    console.log('driverId', driverId)

    const profile = await db.query.driverProfiles.findFirst({
      where: eq(driverProfiles.userId, driverId),
    });

    if (!profile) {
      return reply.code(422).send({ ok: false, error: { code: 'PROFILE_NOT_FOUND', message: 'Driver profile not found.' } });
    }
    if (profile.approvalStatus !== 'approved') {
      return reply.code(422).send({ ok: false, error: { code: 'NOT_APPROVED', message: 'Account not yet approved.', rejectionReason: profile.approvalStatus } });
    }

    await db.update(driverProfiles).set({ availability: 'online' }).where(eq(driverProfiles.userId, driverId));
    await redis.set(`driver:online:${driverId}`, '1', 'EX', 3600).catch(() => null);

    return { ok: true, data: { status: 'online' } };
  });

  // PUT /api/v1/driver/status/offline
  app.put('/offline', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const driverId = req.user.id;

    await db.update(driverProfiles).set({ availability: 'offline' }).where(eq(driverProfiles.userId, driverId));
    await redis.del(`driver:online:${driverId}`).catch(() => null);
    await trackingService.removeDriverLocation(driverId);

    return { ok: true, data: { status: 'offline' } };
  });

  // PUT /api/v1/driver/status/location
  app.put('/location', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = LocationBody.parse(req.body);
    await trackingService.updateDriverLocation(req.user.id, body.lat, body.lng, body.heading);
    return { ok: true };
  });

  // PUT /api/v1/driver/status/radius
  app.put('/radius', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = RadiusBody.parse(req.body);
    await db
      .insert(driverRadiusSettings)
      .values({ driverId: req.user.id, maxRadiusKm: body.radiusKm.toFixed(1) })
      .onConflictDoUpdate({
        target: driverRadiusSettings.driverId,
        set: { maxRadiusKm: body.radiusKm.toFixed(1) },
      });
    return { ok: true, data: { radiusKm: body.radiusKm } };
  });
}
