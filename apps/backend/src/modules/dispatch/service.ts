import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trips, tripOffers, driverProfiles, driverRadiusSettings, fareQuotes, users } from '../../db/schema';
import { redis } from '../../config/redis';
import { trackingService } from '../tracking/service';

/** Extracts lat/lng from a PostGIS geography column that may be returned as a
 *  plain object { x: lng, y: lat } (some pg drivers) or WKT "POINT(lng lat)". */
function extractPoint(raw: unknown): { lat: number; lng: number } {
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const lat = Number(o['y']);
    const lng = Number(o['x']);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  const m = String(raw).match(/POINT\(([^ ]+) ([^ )]+)\)/);
  return m ? { lat: parseFloat(m[2]!), lng: parseFloat(m[1]!) } : { lat: 0, lng: 0 };
}

async function findOnlineDriverIds(): Promise<string[]> {
  const rows = await db.query.driverProfiles.findMany({
    where: eq(driverProfiles.availability, 'online'),
  });
  return rows.map((r) => r.userId);
}

const OFFER_TTL_SEC = 15;
const DISPATCH_RADIUS_KM = 15;
const SEARCH_TIMEOUT_MS = 60 * 1000;

export const dispatchService = {
  /** Called after a trip is created. Finds nearby online drivers and offers the trip. */
  async dispatchTrip(tripId: string): Promise<void> {
    console.log(`[dispatch] dispatchTrip start tripId=${tripId}`);
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip) { console.log(`[dispatch] trip not found`); return; }

    const { lat: pickupLat, lng: pickupLng } = extractPoint(trip.pickup);
    console.log(`[dispatch] pickup lat=${pickupLat} lng=${pickupLng} category=${trip.category}`);

    let nearbyIds = await trackingService.nearbyDrivers(pickupLat, pickupLng, DISPATCH_RADIUS_KM);
    console.log(`[dispatch] Redis GEO nearby drivers: [${nearbyIds.join(', ')}]`);
    if (nearbyIds.length === 0) {
      nearbyIds = await findOnlineDriverIds();
      console.log(`[dispatch] DB fallback online drivers: [${nearbyIds.join(', ')}]`);
    }

    // Filter to drivers online and matching category
    const eligible: string[] = [];
    for (const driverId of nearbyIds) {
      const onlineFlag = await redis.get(`driver:online:${driverId}`).catch(() => null);
      console.log(`[dispatch] driver=${driverId} redis:online=${onlineFlag}`);
      if (!onlineFlag) continue;

      const profile = await db.query.driverProfiles.findFirst({
        where: eq(driverProfiles.userId, driverId),
      });
      console.log(`[dispatch] driver=${driverId} profile.availability=${profile?.availability} approvalStatus=${profile?.approvalStatus}`);
      if (!profile || profile.availability !== 'online') continue;

      const radius = await db.query.driverRadiusSettings.findFirst({
        where: eq(driverRadiusSettings.driverId, driverId),
      });
      const cats = radius?.categories ?? ['go'];
      console.log(`[dispatch] driver=${driverId} acceptedCategories=${JSON.stringify(cats)} tripCategory=${trip.category}`);
      if (!cats.includes(trip.category)) continue;

      eligible.push(driverId);
    }

    console.log(`[dispatch] eligible drivers: [${eligible.join(', ')}]`);
    if (eligible.length === 0) {
      console.log(`[dispatch] no eligible drivers — cancelling trip`);
      await db
        .update(trips)
        .set({ status: 'cancelled', cancelReason: 'no_drivers', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(trips.id, tripId));
      trackingService.emitToRider(trip.riderId, 'trip.no_drivers', { trip_id: tripId });
      return;
    }

    // 1-minute hard timeout: cancel if still unmatched
    setTimeout(async () => {
      const latest = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
      if (latest?.status === 'requested') {
        await db
          .update(trips)
          .set({ status: 'cancelled', cancelReason: 'no_drivers', cancelledAt: new Date(), updatedAt: new Date() })
          .where(and(eq(trips.id, tripId), eq(trips.status, 'requested')));
        trackingService.emitToRider(latest.riderId, 'trip.no_drivers', { trip_id: tripId });
        console.log(`[dispatch] 1-min timeout — no match found, trip cancelled tripId=${tripId}`);
      }
    }, SEARCH_TIMEOUT_MS);

    await dispatchService.offerToDriver(tripId, eligible, 0);
  },

  async offerToDriver(tripId: string, queue: string[], index: number): Promise<void> {
    if (index >= queue.length) {
      // All drivers declined/timed out
      const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
      await db
        .update(trips)
        .set({ status: 'cancelled', cancelReason: 'no_drivers_accepted', cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(trips.id, tripId), eq(trips.status, 'requested')));
      if (trip?.riderId) {
        trackingService.emitToRider(trip.riderId, 'trip.no_drivers', { trip_id: tripId });
      }
      return;
    }

    const driverId = queue[index]!;
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip || trip.status !== 'requested') return; // already matched or cancelled

    // Record the offer
    const expiresAt = new Date(Date.now() + OFFER_TTL_SEC * 1000);
    await db.insert(tripOffers).values({
      tripId,
      driverId,
      status: 'pending',
      expiresAt,
      payload: { queueIndex: index, queueLength: queue.length },
    });

    // Store in Redis for timeout tracking
    await redis
      .set(`offer:${tripId}:current`, driverId, 'EX', OFFER_TTL_SEC)
      .catch(() => null);

    const { lat: pickupLat, lng: pickupLng } = extractPoint(trip.pickup);
    const { lat: destLat, lng: destLng } = extractPoint(trip.dropoff);

    const [quote, rider] = await Promise.all([
      trip.fareQuoteId
        ? db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, trip.fareQuoteId) })
        : null,
      db.query.users.findFirst({ where: eq(users.id, trip.riderId) }),
    ]);

    console.log(`[dispatch] emitting trip.request to driver=${driverId}`);
    trackingService.emitToDriver(driverId, 'trip.request', {
      trip_id: tripId,
      pickup: { lat: pickupLat, lng: pickupLng, address: trip.pickupAddress },
      destination: { lat: destLat, lng: destLng, address: trip.dropoffAddress },
      category: trip.category,
      fare_cents: quote?.totalCents ?? 0,
      rider_name: rider?.fullName ?? 'Rider',
      outside_radius: false,
    });

    // Timeout: if driver doesn't respond in OFFER_TTL_SEC, move to next
    setTimeout(async () => {
      const current = await redis.get(`offer:${tripId}:current`).catch(() => null);
      if (current === driverId) {
        trackingService.emitToDriver(driverId, 'trip.request.timeout', { trip_id: tripId });
        await db
          .update(tripOffers)
          .set({ status: 'terminal', outcome: 'timeout', resolvedAt: new Date() })
          .where(and(eq(tripOffers.tripId, tripId), eq(tripOffers.driverId, driverId)));
        await dispatchService.offerToDriver(tripId, queue, index + 1);
      }
    }, OFFER_TTL_SEC * 1000);
  },

  async handleDriverDecline(driverId: string, tripId: string): Promise<void> {
    const offer = await db.query.tripOffers.findFirst({
      where: and(eq(tripOffers.tripId, tripId), eq(tripOffers.driverId, driverId), eq(tripOffers.status, 'pending')),
    });
    if (!offer) return;

    await db
      .update(tripOffers)
      .set({ status: 'terminal', outcome: 'declined', resolvedAt: new Date() })
      .where(eq(tripOffers.id, offer.id));

    await redis.del(`offer:${tripId}:current`).catch(() => null);

    // Retrieve queue from payload and advance
    const payload = offer.payload as { queueIndex: number; queueLength: number };
    const queueIndex = payload?.queueIndex ?? 0;

    // Re-fetch queue from Redis or re-dispatch; simplified: re-dispatch from next index
    // For a production system this queue would be persisted in Redis
    const nearbyIds = await trackingService.nearbyDrivers(0, 0, DISPATCH_RADIUS_KM).catch(() => []);
    if (nearbyIds.length > queueIndex + 1) {
      await dispatchService.offerToDriver(tripId, nearbyIds, queueIndex + 1);
    }
  },
};
