import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Driver, Fare, Place, RideCategory, Trip } from '@teeko/shared';
import { randomUUID } from 'crypto';
import { pricingService } from '../../modules/pricing/service';
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

// `amountMyr` here is display-only — the charged price comes from the persisted
// quote identified by `quoteId`, never from the client.
const FareShape = z.object({
  rideType: RideCategoryZ,
  amountMyr: z.number(),
  etaMin: z.number(),
  surge: z.number().optional(),
  quoteId: z.string().uuid().optional(),
  expiresAt: z.string().optional(),
}) satisfies z.ZodType<Fare>;

// Accept the shape the client actually sends.
const BookBody = z.object({
  pickup: PlaceShape,
  destination: PlaceShape,
  rideType: RideCategoryZ,
  fare: FareShape,
  // Accepted at the top level too so callers can send it without nesting.
  quoteId: z.string().uuid().optional(),
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

    // The rider is charged the fare they were quoted. redeemQuote enforces
    // ownership, category match, the 5-minute expiry and single use; it throws
    // DomainError (410 QUOTE_EXPIRED etc.) handled by the global error hook.
    const quoteId = body.quoteId ?? fare.quoteId;
    if (!quoteId) {
      throw new DomainError(
        'QUOTE_REQUIRED',
        'A fare quote is required to book. Request a quote first.',
        400,
      );
    }
    const { quote, pickup: quotedPickup, dropoff: quotedDropoff } =
      await pricingService.redeemQuote(quoteId, req.user.id, rideType);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pmId = UUID_RE.test(paymentMethodId) ? paymentMethodId : null;

    // Coordinates come from the quote (authoritative route); addresses come
    // from the client since the quote only stores geometry.
    const dbTrip = await tripsService.requestRide(
      req.user.id, quote, pmId,
      quotedPickup,
      quotedDropoff,
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
      // Echo the authoritative quoted fare, not whatever the client sent.
      fare: {
        rideType,
        amountMyr: quote.totalCents / 100,
        etaMin: Math.ceil(quote.durationSeconds / 60),
        quoteId: quote.id,
        expiresAt: quote.expiresAt.toISOString(),
        ...(Number(quote.surgeMultiplier) > 1 ? { surge: Number(quote.surgeMultiplier) } : {}),
      },
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
