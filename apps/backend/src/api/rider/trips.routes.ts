import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Driver, Fare, Place, RideCategory, Trip } from '@teeko/shared';
import { randomUUID } from 'crypto';
import { db } from '../../db';
import { fareQuotes } from '../../db/schema';
import { tripsService } from '../../modules/trips/service';
import { dispatchService } from '../../modules/dispatch/service';
import { paymentsService } from '../../modules/payments/service';
import { DomainError } from '../../shared/errors';

const RideCategoryZ = z.enum(['go', 'comfort', 'xl', 'premium', 'bike'] satisfies [RideCategory, ...RideCategory[]]);

const PlaceShape = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  address: z.string().optional().default(''),
  lat: z.number().refine((v) => v !== 0, { message: 'lat must not be 0' }),
  lng: z.number().refine((v) => v !== 0, { message: 'lng must not be 0' }),
  category: z.string().optional(),
});

const FareShape = z.object({
  rideType: RideCategoryZ,
  amountMyr: z.number(),
  etaMin: z.number(),
  surge: z.number().optional(),
}) satisfies z.ZodType<Fare>;

// Accept the shape the client actually sends.
const BookBody = z.object({
  pickup: PlaceShape,
  destination: PlaceShape,
  rideType: RideCategoryZ,
  fare: FareShape,
  paymentMethodId: z.string().min(1),
  riderId: z.string().min(1),
});

function mockRoutePolyline(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  steps = 8,
): Array<[number, number]> {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [fromLat + (toLat - fromLat) * t, fromLng + (toLng - fromLng) * t];
  });
}

const MOCK_DRIVER: Driver = {
  id: 'driver-mock-001',
  name: 'Ahmad Farid',
  photoUrl: 'https://i.pravatar.cc/150?img=8',
  rating: 4.8,
  vehicle: { model: 'Perodua Myvi', colour: 'White', seats: 4, category: 'go' },
  plate: 'WXY 1234',
  languages: ['ms', 'en'],
  phone: '+60123456789',
};

export async function routes(app: FastifyInstance) {
  // POST /api/v1/rider/trips/match — mock driver match
  app.post('/match', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return MOCK_DRIVER;
  });

  // POST /api/v1/rider/trips — book a ride
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = BookBody.parse(req.body);
    const { pickup, destination, rideType, fare, paymentMethodId } = body;

    // Block booking while the rider has an unpaid balance (spec §11).
    await paymentsService.assertNoOutstandingDebt(req.user.id);

    const totalCents = Math.round(fare.amountMyr * 100);
    const [quote] = await db.insert(fareQuotes).values({
      riderId: req.user.id,
      category: rideType,
      pickup: `SRID=4326;POINT(${pickup.lng} ${pickup.lat})`,
      dropoff: `SRID=4326;POINT(${destination.lng} ${destination.lat})`,
      pickupAddress: pickup.address,
      dropoffAddress: destination.address,
      distanceMeters: 5000,
      durationSeconds: fare.etaMin * 60,
      baseCents: totalCents,
      totalCents,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }).returning();

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pmId = UUID_RE.test(paymentMethodId) ? paymentMethodId : null;

    const dbTrip = await tripsService.requestRide(
      req.user.id, quote!.id, pmId,
      { lat: pickup.lat, lng: pickup.lng },
      { lat: destination.lat, lng: destination.lng },
      pickup.address, destination.address,
    );

    // Kick off dispatch without blocking the response
    dispatchService.dispatchTrip(dbTrip.id).catch(() => null);

    const routePolyline = mockRoutePolyline(pickup.lat, pickup.lng, destination.lat, destination.lng);
    const approachPolyline = mockRoutePolyline(
      pickup.lat + 0.008, pickup.lng + 0.008,
      pickup.lat, pickup.lng, 4,
    );

    const trip: Trip = {
      id: dbTrip.id,
      status: 'searching',
      riderId: req.user.id,
      pickup: { id: pickup.id, name: pickup.name, address: pickup.address, lat: pickup.lat, lng: pickup.lng },
      destination: { id: destination.id, name: destination.name, address: destination.address, lat: destination.lat, lng: destination.lng },
      rideType,
      fare,
      paymentMethodId,
      routePolyline,
      approachPolyline,
      createdAt: dbTrip.createdAt.toISOString(),
    };
    return reply.code(201).send(trip);
  });

  // GET /api/v1/rider/trips/active — polling fallback for socket events
  app.get('/active', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const data = await tripsService.getRiderActiveTrip(req.user.id);
    return { ok: true, data: data ?? null };
  });

  // GET /api/v1/rider/trips/:id/route — recorded GPS breadcrumbs for route replay
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

  // GET /api/v1/rider/trips — trip history
  app.get('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    return tripsService.getRiderTrips(req.user.id);
  });

  // GET /api/v1/rider/trips/:id — trip detail / receipt
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    try {
      return await tripsService.getRiderTripDetail(req.params.id, req.user.id);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(err.statusCode).send({ ok: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // DELETE /api/v1/rider/trips/:id — cancel ride
  app.delete<{ Params: { id: string }; Body: { reason?: string } }>('/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const reasonCode = (req.body as any)?.reason ?? 'rider_cancelled';
    const result = await tripsService.riderCancelTrip(req.user.id, req.params.id, reasonCode);
    return result;
  });
}
