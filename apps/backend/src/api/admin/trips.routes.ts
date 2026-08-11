import type { FastifyInstance } from 'fastify';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { trips, tripLocationPoints, fareQuotes, disputes } from '../../db/schema/trips';
import { paymentMethods, driverEarnings } from '../../db/schema/payments';
import { users } from '../../db/schema/identity';

// DB trip_status → the status vocabulary the admin panel's StatusChip renders.
// Only `in_trip` differs (the panel + mock data used `in_progress`); the rest
// pass through and StatusChip falls back to a titlecased label for any it
// doesn't explicitly style.
const ADMIN_STATUS: Record<string, string> = {
  requested: 'requested',
  matched: 'matched',
  driver_arrived: 'driver_arrived',
  in_trip: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

// Trips currently on the road — a driver is assigned and the ride is underway.
// `requested` has no driver/location yet; terminal states are excluded.
const LIVE_STATUSES: Array<'matched' | 'driver_arrived' | 'in_trip'> = [
  'matched', 'driver_arrived', 'in_trip',
];

// ST_Y = latitude, ST_X = longitude (geography cast to geometry). Mirrors the
// coordinate extraction in modules/riders/repo.ts.
const latOf = (col: typeof trips.pickup) => sql<number>`ST_Y(${col}::geometry)`;
const lngOf = (col: typeof trips.pickup) => sql<number>`ST_X(${col}::geometry)`;

export async function routes(app: FastifyInstance) {
  // admin · force-cancel, audit
  app.get('/__stub/trips', async () => ({ stub: 'admin · force-cancel, audit' }));

  // ── GET /trips/live ──────────────────────────────────────────────────────
  // Active trips with their current position, for the live trip map. Position
  // is the latest sampled GPS breadcrumb (trip_location_points); if the driver
  // hasn't emitted GPS yet, we fall back to the pickup point so the pin still
  // renders (`live: false` flags the fallback).
  app.get('/live', async () => {
    const rows = await db
      .select({
        id: trips.id,
        driver: users.fullName,
        category: trips.category,
        status: trips.status,
        pickup: trips.pickupAddress,
        dropoff: trips.dropoffAddress,
        pickupLat: latOf(trips.pickup),
        pickupLng: lngOf(trips.pickup),
      })
      .from(trips)
      .innerJoin(users, eq(trips.driverId, users.id))
      .where(inArray(trips.status, LIVE_STATUSES));

    if (rows.length === 0) return [];

    // Latest breadcrumb per trip: DISTINCT ON keeps one row per trip, the
    // newest by recorded_at.
    const points = await db
      .selectDistinctOn([tripLocationPoints.tripId], {
        tripId: tripLocationPoints.tripId,
        lat: sql<number>`ST_Y(${tripLocationPoints.location}::geometry)`,
        lng: sql<number>`ST_X(${tripLocationPoints.location}::geometry)`,
        heading: tripLocationPoints.heading,
        recordedAt: tripLocationPoints.recordedAt,
      })
      .from(tripLocationPoints)
      .where(inArray(tripLocationPoints.tripId, rows.map((r) => r.id)))
      .orderBy(tripLocationPoints.tripId, desc(tripLocationPoints.recordedAt));

    const latest = new Map(points.map((p) => [p.tripId, p]));

    return rows.map((r) => {
      const p = latest.get(r.id);
      return {
        id: r.id,
        driver: r.driver,
        category: r.category,
        status: r.status,
        pickup: r.pickup,
        dropoff: r.dropoff,
        lat: Number(p?.lat ?? r.pickupLat),
        lng: Number(p?.lng ?? r.pickupLng),
        heading: p?.heading != null ? Number(p.heading) : null,
        recordedAt: p?.recordedAt?.toISOString() ?? null,
        live: p != null,
      };
    });
  });

  // ── GET /trips?limit=500 ───────────────────────────────────────────────────
  // Trip history table for the admin panel — every trip (all statuses), newest
  // first. Joins in the fare quote (distance + surge), the payment method type,
  // and the driver's frozen commission, and flags trips with an open dispute.
  // Money is stored as integer sen; we return major-unit ringgit (RM).
  app.get<{ Querystring: { limit?: string } }>('/', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000);

    const rows = await db
      .select({
        id: trips.id,
        driverId: trips.driverId,
        riderId: trips.riderId,
        status: trips.status,
        category: trips.category,
        date: trips.createdAt,
        pickup: trips.pickupAddress,
        dropoff: trips.dropoffAddress,
        distanceMeters: fareQuotes.distanceMeters,
        finalFareCents: trips.finalFareCents,
        quoteFareCents: fareQuotes.totalCents,
        surge: fareQuotes.surgeMultiplier,
        commissionCents: driverEarnings.commissionCents,
        paymentMethod: paymentMethods.type,
        // One correlated EXISTS is cheaper than a join + de-dup when a trip can
        // have several dispute rows over its lifetime.
        dispute: sql<boolean>`exists (select 1 from ${disputes} where ${disputes.tripId} = ${trips.id})`,
      })
      .from(trips)
      .leftJoin(fareQuotes, eq(trips.fareQuoteId, fareQuotes.id))
      .leftJoin(paymentMethods, eq(trips.paymentMethodId, paymentMethods.id))
      .leftJoin(driverEarnings, eq(driverEarnings.tripId, trips.id))
      .orderBy(desc(trips.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      driverId: r.driverId ?? '',
      riderId: r.riderId,
      status: ADMIN_STATUS[r.status] ?? r.status,
      category: r.category,
      // trips carry no city column; the panel column stays blank rather than
      // guessing one from the free-text pickup address.
      city: '',
      date: r.date.toISOString(),
      pickup: r.pickup ?? '',
      dropoff: r.dropoff ?? '',
      distance: r.distanceMeters != null ? r.distanceMeters / 1000 : 0,
      fare: (r.finalFareCents ?? r.quoteFareCents ?? 0) / 100,
      commission: (r.commissionCents ?? 0) / 100,
      surge: r.surge != null ? Number(r.surge) : 1,
      paymentMethod: r.paymentMethod ?? '',
      dispute: r.dispute,
    }));
  });
}
