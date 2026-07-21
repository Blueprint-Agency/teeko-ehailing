import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Fare, RideCategory } from '@teeko/shared';
import { pricingService } from '../../modules/pricing/service';

// Accept Place objects (with id/name/address) or bare lat/lng; support both
// `dest` and `destination` keys so the client and backend stay in sync.
const LatLngShape = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  id: z.string().optional(),
  name: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
});

const QuoteBody = z.object({
  pickup: LatLngShape,
  // client sends `destination`; keep `dest` as fallback
  destination: LatLngShape.optional(),
  dest: LatLngShape.optional(),
}).refine((b) => b.destination ?? b.dest, { message: 'destination or dest is required' });

// Ride types surfaced to the rider UI. The pricing engine prices all five
// categories; we expose the subset the ride-selection screen renders.
const VISIBLE_RIDE_TYPES: RideCategory[] = ['go', 'comfort', 'xl'];

export async function routes(app: FastifyInstance) {
  // POST /api/v1/rider/quotes
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = QuoteBody.parse(req.body);
    const dest = body.destination ?? body.dest!;

    // Canonical sen-integer engine: real road distance/time (Google Distance
    // Matrix), surge, and persisted itemised quotes. Throws DomainError
    // (ROUTE_UNAVAILABLE, 422) when no route exists — handled globally.
    const quotes = await pricingService.getQuotes(
      req.user.id,
      { lat: body.pickup.lat, lng: body.pickup.lng },
      { lat: dest.lat, lng: dest.lng },
      VISIBLE_RIDE_TYPES,
    );

    const fares: Fare[] = quotes
      .map((q) => ({
        rideType: q.category as RideCategory,
        amountMyr: q.totalCents / 100,
        etaMin: q.durationMin,
        // The rider books against this id — it is what locks the displayed
        // price to the price charged. `expiresAt` lets the client re-quote
        // before the backend starts rejecting it with 410.
        quoteId: q.quoteId,
        expiresAt: q.expiresAt,
        ...(q.surgeMultiplier > 1 ? { surge: q.surgeMultiplier } : {}),
      }));

    return reply.code(201).send(fares);
  });
}
