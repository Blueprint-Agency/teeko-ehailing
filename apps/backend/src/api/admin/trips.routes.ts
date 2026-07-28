import type { FastifyInstance } from 'fastify';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { trips, tripLocationPoints } from '../../db/schema/trips';
import { users } from '../../db/schema/identity';

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
}
