import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { fareQuotes, fareLines, surgeConfig, surgeZones, trips } from '../../db/schema';
import { getDistanceMatrix, MapsApiError } from '../../external/googleMaps';
import { redis } from '../../config/redis';
import { DomainError } from '../../shared/errors';

// RM fare matrix per category
const FARE_MATRIX = {
  go: { baseCents: 200, perKmCents: 110, perMinCents: 18, minCents: 500 },
  comfort: { baseCents: 300, perKmCents: 140, perMinCents: 22, minCents: 700 },
  xl: { baseCents: 400, perKmCents: 180, perMinCents: 25, minCents: 900 },
  premium: { baseCents: 600, perKmCents: 250, perMinCents: 35, minCents: 1500 },
  bike: { baseCents: 150, perKmCents: 70, perMinCents: 12, minCents: 300 },
} as const;

export type RideCategory = keyof typeof FARE_MATRIX;

/** How long a quoted fare is honoured. The rider is locked to this price until it lapses. */
export const QUOTE_TTL_MS = 5 * 60 * 1000;

/**
 * A persisted quote row that has passed `redeemQuote`. Trip creation takes this
 * rather than a bare id so validation cannot be skipped by a new caller.
 */
export type RedeemedQuote = typeof fareQuotes.$inferSelect;

export type FareQuoteItem = {
  quoteId: string;
  category: RideCategory;
  distanceKm: number;
  durationMin: number;
  totalCents: number;
  surgeMultiplier: number;
  expiresAt: string;
};

/** Matches the bounds the admin surge UI enforces (admin/surge.routes.ts). */
const SURGE_MIN = 1.0;
const SURGE_MAX = 3.0;

/**
 * Short TTL so admin surge edits reach riders promptly. Without a TTL the old
 * global `surge:multiplier` key masked config changes indefinitely.
 */
const SURGE_CACHE_TTL_SECONDS = 30;

function clampSurge(value: number): number {
  if (!Number.isFinite(value)) return SURGE_MIN;
  return Math.min(SURGE_MAX, Math.max(SURGE_MIN, value));
}

/**
 * A zone's effective multiplier: an unexpired admin override wins over the
 * worker's computed value. Kept as SQL so overlapping zones can be ranked by
 * their *effective* rate rather than by whichever column happens to be set.
 */
const effectiveZoneMultiplier = sql<string | null>`
  CASE
    WHEN ${surgeZones.manualMultiplier} IS NOT NULL
     AND ${surgeZones.manualUntil} IS NOT NULL
     AND ${surgeZones.manualUntil} > now()
    THEN ${surgeZones.manualMultiplier}
    ELSE ${surgeZones.autoMultiplier}
  END`;

/**
 * Resolution order: active surge zone covering the pickup point (highest
 * effective multiplier wins when zones overlap) › global `surge_config` row ›
 * 1.0. Within a zone: unexpired admin override › worker-computed value.
 *
 * Zones are what the admin surge map and the recompute worker both write, so
 * this is the path that makes either actually affect rider pricing.
 */
async function lookupSurgeMultiplier(pickup: { lat: number; lng: number }): Promise<number> {
  const now = new Date();
  const point = sql`ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography`;

  const [zone] = await db
    .select({ multiplier: effectiveZoneMultiplier })
    .from(surgeZones)
    .where(
      and(
        eq(surgeZones.active, true),
        lte(surgeZones.activeFrom, now),
        gte(surgeZones.activeUntil, now),
        sql`ST_Covers(${surgeZones.polygon}, ${point})`,
        sql`${effectiveZoneMultiplier} IS NOT NULL`,
      ),
    )
    .orderBy(desc(effectiveZoneMultiplier))
    .limit(1);

  if (zone?.multiplier != null) return clampSurge(parseFloat(zone.multiplier));

  const row = await db.query.surgeConfig.findFirst({ where: eq(surgeConfig.id, 1) });
  return row ? clampSurge(parseFloat(row.multiplier)) : SURGE_MIN;
}

async function getSurgeMultiplier(pickup: { lat: number; lng: number }): Promise<number> {
  // ~110m granularity — enough to reuse the zone lookup across nearby pickups
  // without smearing a zone boundary across a wide area.
  const cacheKey = `surge:resolved:${pickup.lat.toFixed(3)},${pickup.lng.toFixed(3)}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return clampSurge(parseFloat(cached));

  const multiplier = await lookupSurgeMultiplier(pickup);
  await redis
    .set(cacheKey, multiplier.toFixed(2), 'EX', SURGE_CACHE_TTL_SECONDS)
    .catch(() => null);
  return multiplier;
}

/** Parse a geography column back into lat/lng (pg returns EWKB hex → WKT via _types). */
function extractPoint(raw: unknown): { lat: number; lng: number } | null {
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const lat = Number(o['y']);
    const lng = Number(o['x']);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  const m = String(raw).match(/POINT\(([^ ]+) ([^ )]+)\)/);
  return m ? { lat: parseFloat(m[2]!), lng: parseFloat(m[1]!) } : null;
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
  /**
   * Price and persist a quote per requested category. Callers pass only the
   * categories they will surface — every category priced here writes a
   * `fare_quotes` row plus its `fare_lines`, so quoting hidden ones is pure
   * write amplification.
   */
  async getQuotes(
    riderId: string,
    pickup: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    categories: RideCategory[] = Object.keys(FARE_MATRIX) as RideCategory[],
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
    const surge = await getSurgeMultiplier(pickup);
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);

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

        // Surge is the residual after the metered lines. Clamped at 0 because
        // the minimum-fare floor can exceed base+distance+time on short trips,
        // which would otherwise record a negative surge line.
        const surgeCents = Math.max(0, totalCents - (baseCents + distanceCents + timeCents));

        await db.insert(fareLines).values([
          { quoteId: row.id, kind: 'base', amountCents: baseCents },
          { quoteId: row.id, kind: 'distance', amountCents: distanceCents },
          { quoteId: row.id, kind: 'time', amountCents: timeCents },
          ...(surge > 1 && surgeCents > 0
            ? [{ quoteId: row.id, kind: 'surge' as const, amountCents: surgeCents }]
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

  /**
   * Validate a quote before it is turned into a trip. Returns the persisted
   * quote — callers must price the trip from *this* row, never from a
   * client-supplied amount.
   *
   * Throws DomainError: QUOTE_NOT_FOUND (404), QUOTE_FORBIDDEN (403),
   * QUOTE_CATEGORY_MISMATCH (400), QUOTE_EXPIRED (410), QUOTE_ALREADY_USED (409).
   */
  async redeemQuote(quoteId: string, riderId: string, category: string) {
    const quote = await db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, quoteId) });
    if (!quote) {
      throw new DomainError('QUOTE_NOT_FOUND', 'That fare quote no longer exists.', 404);
    }
    if (quote.riderId !== riderId) {
      throw new DomainError('QUOTE_FORBIDDEN', 'That fare quote belongs to another rider.', 403);
    }
    if (quote.category !== category) {
      throw new DomainError(
        'QUOTE_CATEGORY_MISMATCH',
        `That quote is for ${quote.category}, not ${category}.`,
        400,
      );
    }
    if (quote.expiresAt.getTime() <= Date.now()) {
      throw new DomainError('QUOTE_EXPIRED', 'Fare quote expired — please refresh the price.', 410);
    }

    // Single-use: stops a rider replaying one cheap quote into several trips
    // during its validity window.
    const existing = await db.query.trips.findFirst({ where: eq(trips.fareQuoteId, quoteId) });
    if (existing) {
      throw new DomainError('QUOTE_ALREADY_USED', 'That fare quote has already been booked.', 409);
    }

    // Return the quote's own coordinates so the trip is created on exactly the
    // route that was priced — a client cannot quote a short hop and then book a
    // long one at that price.
    const pickup = extractPoint(quote.pickup);
    const dropoff = extractPoint(quote.dropoff);
    if (!pickup || !dropoff) {
      throw new DomainError('QUOTE_CORRUPT', 'Fare quote is missing its route.', 422);
    }

    return { quote, pickup, dropoff };
  },
};
