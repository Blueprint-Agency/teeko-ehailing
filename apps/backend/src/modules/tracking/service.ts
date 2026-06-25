import type { Socket } from 'socket.io';
import { redis } from '../../config/redis';
import { getDistanceMatrix } from '../../external/googleMaps';
import { getIO } from '../../config/socketio';
import { db } from '../../db';
import { tripLocationPoints } from '../../db/schema';
import { wktPoint } from '../../shared/geo';

// In-memory socket maps — replaced by Redis adapter in multi-instance prod
const driverSockets = new Map<string, Socket>();
const riderSockets = new Map<string, Socket>();

// ---- trip breadcrumb sampling ----
// Persist at most one DB row per driver per ~5s AND ~25m moved, so live
// WebSocket streaming (every few seconds) stays decoupled from durable writes.
// 5s keeps route fidelity through turns; the distance gate drops the duplicate
// rows a driver would otherwise emit while idling at a light or in a jam.
const MIN_PERSIST_INTERVAL_MS = 5_000;
const MIN_PERSIST_DISTANCE_M = 25;

type PersistState = { tripId: string; ts: number; lat: number; lng: number };
const lastPersist = new Map<string, PersistState>();

// Haversine distance in metres between two coordinates.
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const trackingService = {
  // ---- socket registry ----
  registerDriver(driverId: string, socket: Socket) {
    driverSockets.set(driverId, socket);
  },
  registerRider(riderId: string, socket: Socket) {
    riderSockets.set(riderId, socket);
  },
  unregisterDriver(driverId: string) {
    driverSockets.delete(driverId);
  },
  unregisterRider(riderId: string) {
    riderSockets.delete(riderId);
  },
  getDriverSocket(driverId: string): Socket | undefined {
    return driverSockets.get(driverId);
  },
  getRiderSocket(riderId: string): Socket | undefined {
    return riderSockets.get(riderId);
  },

  // ---- Redis GEO ----
  async updateDriverLocation(
    driverId: string,
    lat: number,
    lng: number,
    heading: number,
  ): Promise<void> {
    await redis
      .pipeline()
      .hset(`driver:location:${driverId}`, { lat, lng, heading, ts: Date.now() })
      // Presence TTL. Drivers heartbeat every ~10s (even when parked), so 45s
      // gives ~4 missed beats of margin before a driver is treated as stale.
      .expire(`driver:location:${driverId}`, 45)
      .geoadd('driver:locations', lng, lat, driverId)
      .exec()
      .catch(() => null); // Redis optional — degrade gracefully
  },

  async removeDriverLocation(driverId: string): Promise<void> {
    lastPersist.delete(driverId);
    await redis
      .pipeline()
      .del(`driver:location:${driverId}`)
      .zrem('driver:locations', driverId)
      .exec()
      .catch(() => null);
  },

  /** Persist a sampled GPS breadcrumb for an active trip into Postgres.
   *  Throttled to ~5s AND ~25m moved per driver (always records the first point
   *  of a trip). Safe to call on every WebSocket location event — it self-gates
   *  and never throws (a failed write degrades to a dropped breadcrumb). */
  async persistTripLocation(
    tripId: string,
    driverId: string,
    lat: number,
    lng: number,
    heading: number,
  ): Promise<void> {
    const prev = lastPersist.get(driverId);
    const now = Date.now();

    if (prev && prev.tripId === tripId) {
      const elapsed = now - prev.ts;
      const moved = distanceMeters(prev.lat, prev.lng, lat, lng);
      if (elapsed < MIN_PERSIST_INTERVAL_MS || moved < MIN_PERSIST_DISTANCE_M) return;
    }

    lastPersist.set(driverId, { tripId, ts: now, lat, lng });

    await db
      .insert(tripLocationPoints)
      .values({
        tripId,
        driverId,
        location: wktPoint({ lat, lng }),
        heading: String(heading),
      })
      .catch(() => null); // durable breadcrumb is best-effort — never block tracking
  },

  // Fix 4: Clear the driver:online Redis key so dispatch stops treating a
  // disconnected driver as available. Without this the key lives for its full
  // 1-hour TTL even after the socket drops, causing dispatch to emit offers
  // to a socket that no longer exists.
  async clearDriverOnlineStatus(driverId: string): Promise<void> {
    await redis.del(`driver:online:${driverId}`).catch(() => null);
  },

  async getDriverLocation(
    driverId: string,
  ): Promise<{ lat: number; lng: number; heading: number } | null> {
    const raw = await redis.hgetall(`driver:location:${driverId}`).catch(() => null);
    if (!raw || !raw['lat']) return null;
    return {
      lat: parseFloat(raw['lat']!),
      lng: parseFloat(raw['lng']!),
      heading: parseFloat(raw['heading'] ?? '0'),
    };
  },

  /** Returns driver IDs within radiusKm of a point, nearest first.
   *  Filters out stale entries whose location hash (TTL=30s) has expired. */
  async nearbyDrivers(
    lat: number,
    lng: number,
    radiusKm: number,
    limit = 20,
  ): Promise<string[]> {
    const results = await redis
      .georadius('driver:locations', lng, lat, radiusKm, 'km', 'ASC', 'COUNT', limit)
      .catch(() => [] as string[]);

    const ids = results as string[];
    const fresh: string[] = [];
    const stale: string[] = [];

    await Promise.all(
      ids.map(async (id) => {
        const exists = await redis.exists(`driver:location:${id}`).catch(() => 1);
        if (exists) {
          fresh.push(id);
        } else {
          stale.push(id);
        }
      }),
    );

    // Evict stale GEO entries so they don't accumulate
    if (stale.length) {
      await redis.zrem('driver:locations', ...stale).catch(() => null);
    }

    return fresh;
  },

  /** ETA from driverLocation to pickupCoords in minutes. */
  async getEtaMinutes(
    driverLocation: { lat: number; lng: number },
    pickupCoords: { lat: number; lng: number },
  ): Promise<number> {
    try {
      const r = await getDistanceMatrix(driverLocation, pickupCoords);
      return Math.max(1, Math.ceil(r.durationSeconds / 60));
    } catch {
      return 5; // fallback ETA
    }
  },

  // ---- emit helpers ----
  emitToDriver(driverId: string, event: string, payload: unknown): void {
    const s = driverSockets.get(driverId);
    console.log(`[tracking] emitToDriver driverId=${driverId} event=${event} socketFound=${!!s}`);
    s?.emit(event, payload);
  },

  emitToRider(riderId: string, event: string, payload: unknown): void {
    const s = riderSockets.get(riderId);
    const io = getIO();
    console.log(`[tracking] emitToRider riderId=${riderId} event=${event} directSocketFound=${!!s} ioReady=${!!io}`);
    if (s?.connected) {
      // Direct socket emit — fastest path
      s.emit(event, payload);
    } else if (io) {
      // Room-based fallback: gateway calls socket.join('rider:{id}') on auth,
      // so this reaches the rider even if riderSockets map is stale or unpopulated.
      console.log(`[tracking] emitToRider falling back to room rider:${riderId}`);
      io.to(`rider:${riderId}`).emit(event, payload);
    } else {
      console.log(`[tracking] emitToRider DROPPED — no socket and no io instance`);
    }
  },
};
