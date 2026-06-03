import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { fareQuotes, fareLines, surgeConfig } from '../../db/schema';
import { getDistanceMatrix, MapsApiError } from '../../external/googleMaps';
import { redis } from '../../config/redis';
import { DomainError } from '../../shared/errors';

// RM fare matrix per category
const FARE_MATRIX = {
  go:      { baseCents: 200, perKmCents: 110, perMinCents: 18, minCents: 500 },
  comfort: { baseCents: 300, perKmCents: 140, perMinCents: 22, minCents: 700 },
  xl:      { baseCents: 400, perKmCents: 180, perMinCents: 25, minCents: 900 },
  premium: { baseCents: 600, perKmCents: 250, perMinCents: 35, minCents: 1500 },
  bike:    { baseCents: 150, perKmCents:  70, perMinCents: 12, minCents: 300 },
} as const;

export type RideCategory = keyof typeof FARE_MATRIX;

export type FareQuoteItem = {
  quoteId: string;
  category: RideCategory;
  distanceKm: number;
  durationMin: number;
  totalCents: number;
  surgeMultiplier: number;
  expiresAt: string;
};

async function getSurgeMultiplier(): Promise<number> {
  const cached = await redis.get('surge:multiplier').catch(() => null);
  if (cached) return parseFloat(cached);
  const row = await db.query.surgeConfig.findFirst({ where: eq(surgeConfig.id, 1) });
  return row ? parseFloat(row.multiplier) : 1.0;
}

function routeHash(
  pickup: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): string {
  return `${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}:${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
}

function calcFare(
  category: RideCategory,
  distanceKm: number,
  durationMin: number,
  surge: number,
): number {
  const m = FARE_MATRIX[category];
  const raw =
    m.baseCents + Math.round(m.perKmCents * distanceKm) + Math.round(m.perMinCents * durationMin);
  return Math.max(m.minCents, Math.round(raw * surge));
}

export const pricingService = {
  async getQuotes(
    riderId: string,
    pickup: { lat: number; lng: number },
    dest: { lat: number; lng: number },
  ): Promise<FareQuoteItem[]> {
    // Check Redis cache to avoid redundant Distance Matrix calls
    const hash = routeHash(pickup, dest);
    const cacheKey = `estimate:${hash}`;
    const cached = await redis.get(cacheKey).catch(() => null);

    let distanceMeters: number;
    let durationSeconds: number;

    if (cached) {
      const parsed = JSON.parse(cached) as { distanceMeters: number; durationSeconds: number };
      distanceMeters = parsed.distanceMeters;
      durationSeconds = parsed.durationSeconds;
    } else {
      try {
        const result = await getDistanceMatrix(pickup, dest);
        distanceMeters = result.distanceMeters;
        durationSeconds = result.durationSeconds;
        await redis
          .set(cacheKey, JSON.stringify({ distanceMeters, durationSeconds }), 'EX', 180)
          .catch(() => null);
      } catch (err) {
        if (err instanceof MapsApiError && err.statusCode === 422) {
          throw new DomainError('ROUTE_UNAVAILABLE', 'No route found between pickup and destination.', 422);
        }
        throw err;
      }
    }

    const distanceKm = distanceMeters / 1000;
    const durationMin = Math.ceil(durationSeconds / 60);
    const surge = await getSurgeMultiplier();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // quotes valid 5 minutes

    const categories = Object.keys(FARE_MATRIX) as RideCategory[];
    const quotes = await Promise.all(
      categories.map(async (category) => {
        const totalCents = calcFare(category, distanceKm, durationMin, surge);
        const baseCents = FARE_MATRIX[category].baseCents;
        const distanceCents = Math.round(FARE_MATRIX[category].perKmCents * distanceKm);
        const timeCents = Math.round(FARE_MATRIX[category].perMinCents * durationMin);

        const pickupWkt = `SRID=4326;POINT(${pickup.lng} ${pickup.lat})`;
        const dropoffWkt = `SRID=4326;POINT(${dest.lng} ${dest.lat})`;
        const row = await db
          .insert(fareQuotes)
          .values({
            riderId,
            category,
            pickup: pickupWkt,
            dropoff: dropoffWkt,
            distanceMeters,
            durationSeconds,
            baseCents,
            surgeMultiplier: surge.toFixed(2),
            totalCents,
            expiresAt,
          })
          .returning()
          .then((r) => r[0]!);

        await db.insert(fareLines).values([
          { quoteId: row.id, kind: 'base', amountCents: baseCents },
          { quoteId: row.id, kind: 'distance', amountCents: distanceCents },
          { quoteId: row.id, kind: 'time', amountCents: timeCents },
          ...(surge > 1
            ? [{ quoteId: row.id, kind: 'surge' as const, amountCents: totalCents - Math.round((baseCents + distanceCents + timeCents) * 1) }]
            : []),
        ]);

        return {
          quoteId: row.id,
          category,
          distanceKm: Math.round(distanceKm * 10) / 10,
          durationMin,
          totalCents,
          surgeMultiplier: surge,
          expiresAt: expiresAt.toISOString(),
        };
      }),
    );

    return quotes.sort((a, b) => a.totalCents - b.totalCents);
  },

  async getQuoteById(quoteId: string) {
    return db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, quoteId) });
  },
};
