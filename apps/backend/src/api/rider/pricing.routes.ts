import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Fare, RideCategory } from '@teeko/shared';

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

const RIDE_TYPES: RideCategory[] = ['go', 'comfort', 'xl'];

function mockFares(pickupLat: number, pickupLng: number, destLat: number, destLng: number): Fare[] {
  const dlat = destLat - pickupLat;
  const dlng = destLng - pickupLng;
  const distKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
  const basePrices: Record<RideCategory, number> = { go: 1.2, comfort: 1.6, xl: 2.0, premium: 2.8, bike: 0.8 };
  const etaBase: Record<RideCategory, number> = { go: 5, comfort: 7, xl: 8, premium: 10, bike: 3 };
  return RIDE_TYPES.map((type) => ({
    rideType: type,
    amountMyr: Math.max(5, parseFloat((basePrices[type] * distKm + 2).toFixed(2))),
    etaMin: etaBase[type],
  }));
}

export async function routes(app: FastifyInstance) {
  // POST /api/v1/rider/quotes
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const body = QuoteBody.parse(req.body);
    const dest = body.destination ?? body.dest!;
    const fares = mockFares(body.pickup.lat, body.pickup.lng, dest.lat, dest.lng);
    return reply.code(201).send(fares);
  });
}
