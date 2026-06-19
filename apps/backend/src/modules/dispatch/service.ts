import { and, eq, inArray, not } from 'drizzle-orm';
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

// Fix 1: Retry emitting to a driver whose socket auth handshake may not have
// completed yet. Dispatch fires immediately after trip creation, so the driver
// socket might not be in driverSockets when the first attempt is made.
// We retry up to maxAttempts times with delayMs between each try.
async function emitWithRetry(
  driverId: string,
  event: string,
  payload: unknown,
  maxAttempts = 4,
  delayMs = 2_000,
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const s = trackingService.getDriverSocket(driverId);
    if (s?.connected) {
      s.emit(event, payload);
      console.log(`[dispatch] emitWithRetry OK driverId=${driverId} event=${event} attempt=${attempt + 1}`);
      return true;
    }
    console.log(`[dispatch] emitWithRetry no socket yet driverId=${driverId} attempt=${attempt + 1}/${maxAttempts}`);
    if (attempt < maxAttempts - 1) {
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

const OFFER_TTL_SEC = 15;
const DISPATCH_RADIUS_KM = 15;
const SEARCH_TIMEOUT_MS = 60 * 1000;

// Fix 3: Default to all supported categories so drivers without an explicit
// driverRadiusSettings.categories value are eligible for every ride type,
// not just 'go' (the old fallback that silently blocked comfort/xl/premium/bike).
const ALL_CATEGORIES = ['go', 'comfort', 'xl', 'premium', 'bike'];

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
      // Use DB profile as the sole source of truth for online status.
      // The previous Redis key check (driver:online:{id}) was removed because it
      // caused a regression: Fix 4 deletes the key on socket disconnect, and any
      // booking that arrived during the reconnect window found no key → driver
      // skipped → trip cancelled immediately. The DB availability field is set by
      // the explicit goOnline/goOffline REST calls and is authoritative; the Redis
      // key was only a cache optimisation that created false negatives.
      const profile = await db.query.driverProfiles.findFirst({
        where: eq(driverProfiles.userId, driverId),
      });
      console.log(`[dispatch] driver=${driverId} profile.availability=${profile?.availability} approvalStatus=${profile?.approvalStatus}`);
      if (!profile || profile.availability !== 'online') continue;

      // Skip drivers who already have an active trip — otherwise a driver who just
      // accepted trip A can receive trip B immediately if trip A's offer timeout
      // fires and the rider retries before the driver goes offline.
      const activeTrip = await db.query.trips.findFirst({
        where: and(
          eq(trips.driverId, driverId),
          not(inArray(trips.status, ['completed', 'cancelled', 'no_show'])),
        ),
      });
      if (activeTrip) {
        console.log(`[dispatch] driver=${driverId} has active trip ${activeTrip.id} (${activeTrip.status}), skipping`);
        continue;
      }

      const radius = await db.query.driverRadiusSettings.findFirst({
        where: eq(driverRadiusSettings.driverId, driverId),
      });
      // Fix 3: Fall back to ALL_CATEGORIES instead of just ['go'].
      const cats = (radius?.categories as string[] | null | undefined) ?? ALL_CATEGORIES;
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

    await dispatchService.offerToDriver(tripId, eligible, 0, pickupLat, pickupLng);
  },

  async offerToDriver(
    tripId: string,
    queue: string[],
    index: number,
    pickupLat?: number,
    pickupLng?: number,
  ): Promise<void> {
    if (index >= queue.length) {
      const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
      // Only cancel and notify if the trip is still waiting for a driver.
      // If the trip was already matched (driver accepted during the offer window),
      // this branch is stale — emitting trip.no_drivers here would incorrectly
      // reset the rider's screen to "no drivers" even though a driver is en route.
      if (trip?.status !== 'requested') return;
      await db
        .update(trips)
        .set({ status: 'cancelled', cancelReason: 'no_drivers_accepted', cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(trips.id, tripId), eq(trips.status, 'requested')));
      if (trip.riderId) {
        trackingService.emitToRider(trip.riderId, 'trip.no_drivers', { trip_id: tripId });
      }
      return;
    }

    const driverId = queue[index]!;
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip || trip.status !== 'requested') return;

    // Resolve pickup coords from explicit params (preferred) or DB
    const pLat = pickupLat ?? extractPoint(trip.pickup).lat;
    const pLng = pickupLng ?? extractPoint(trip.pickup).lng;

    // Fix 2: Persist the full queue and pickup coords in the offer payload so
    // handleDriverDecline can advance the queue correctly without re-querying
    // Redis GEO (the old code called nearbyDrivers(0, 0, ...) — lat/lng both
    // zero, which is in the Atlantic Ocean, returning no Malaysian drivers).
    const expiresAt = new Date(Date.now() + OFFER_TTL_SEC * 1000);
    await db.insert(tripOffers).values({
      tripId,
      driverId,
      status: 'pending',
      expiresAt,
      payload: { queueIndex: index, queueLength: queue.length, queue, pickupLat: pLat, pickupLng: pLng },
    });

    await redis
      .set(`offer:${tripId}:current`, driverId, 'EX', OFFER_TTL_SEC)
      .catch(() => null);

    const { lat: destLat, lng: destLng } = extractPoint(trip.dropoff);

    const [quote, rider] = await Promise.all([
      trip.fareQuoteId
        ? db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, trip.fareQuoteId) })
        : null,
      db.query.users.findFirst({ where: eq(users.id, trip.riderId) }),
    ]);

    const requestPayload = {
      trip_id: tripId,
      pickup: { lat: pLat, lng: pLng, address: trip.pickupAddress },
      destination: { lat: destLat, lng: destLng, address: trip.dropoffAddress },
      category: trip.category,
      fare_cents: quote?.totalCents ?? 0,
      rider_name: rider?.fullName ?? 'Rider',
      outside_radius: false,
    };

    // Fix 1: Use retry wrapper instead of a fire-and-forget single emit.
    // The driver socket may not have finished its auth handshake by the time
    // dispatch runs (connect → async getToken → emit auth → server registers).
    // We retry every 2s for up to 8s total; if the socket never appears we
    // skip this driver and offer to the next one in the queue.
    console.log(`[dispatch] offering trip.request to driver=${driverId} (with retry)`);
    const delivered = await emitWithRetry(driverId, 'trip.request', requestPayload);
    if (!delivered) {
      console.log(`[dispatch] socket never became available for driver=${driverId}, skipping`);
      await dispatchService.offerToDriver(tripId, queue, index + 1, pLat, pLng);
      return;
    }

    // Timeout: if driver doesn't respond in OFFER_TTL_SEC, move to next
    setTimeout(async () => {
      const current = await redis.get(`offer:${tripId}:current`).catch(() => null);
      if (current === driverId) {
        trackingService.emitToDriver(driverId, 'trip.request.timeout', { trip_id: tripId });
        await db
          .update(tripOffers)
          .set({ status: 'terminal', outcome: 'timeout', resolvedAt: new Date() })
          .where(and(eq(tripOffers.tripId, tripId), eq(tripOffers.driverId, driverId)));
        await dispatchService.offerToDriver(tripId, queue, index + 1, pLat, pLng);
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

    // Fix 2: Read the persisted queue and pickup coords from the offer payload
    // instead of calling nearbyDrivers(0, 0, ...) which searched the Atlantic Ocean.
    const payload = offer.payload as {
      queueIndex: number;
      queue: string[];
      pickupLat: number;
      pickupLng: number;
    };
    const queue = Array.isArray(payload?.queue) ? payload.queue : [];
    const nextIndex = (payload?.queueIndex ?? 0) + 1;

    if (nextIndex < queue.length) {
      await dispatchService.offerToDriver(tripId, queue, nextIndex, payload.pickupLat, payload.pickupLng);
    } else {
      const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
      await db
        .update(trips)
        .set({ status: 'cancelled', cancelReason: 'no_drivers_accepted', cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(trips.id, tripId), eq(trips.status, 'requested')));
      if (trip?.riderId) {
        trackingService.emitToRider(trip.riderId, 'trip.no_drivers', { trip_id: tripId });
      }
    }
  },
};
