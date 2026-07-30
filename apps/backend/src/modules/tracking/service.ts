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

// ---- ETA throttling ----
// Google Distance Matrix is billed per element and drivers heartbeat every ~10s,
// so recomputing the ETA on every location ping costs one call per driver per
// heartbeat and scales linearly with concurrent trips. A pickup ETA in whole
// minutes barely moves in 20s, so cache it and let location itself stream freely.
const ETA_TTL_MS = 20_000;
const etaCache = new Map<string, { ts: number; etaMin: number }>();

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
  // Keyed by userId, so a reconnect (or a second device) overwrites the entry.
  // The disconnect of the *superseded* socket then arrives late — unregister
  // therefore takes the disconnecting socket's id and only clears the entry if
  // that socket still owns it. Without this check a stale disconnect deletes the
  // live socket, leaving the driver connected but unreachable by dispatch.
  registerDriver(driverId: string, socket: Socket) {
    driverSockets.set(driverId, socket);
  },
  registerRider(riderId: string, socket: Socket) {
    riderSockets.set(riderId, socket);
  },
  /** Returns true if the socket owned the registry entry (i.e. this is a real
   *  disconnect, not a superseded one) — callers gate their teardown on it. */
  unregisterDriver(driverId: string, socketId?: string): boolean {
    const current = driverSockets.get(driverId);
    if (socketId && current && current.id !== socketId) return false;
    driverSockets.delete(driverId);
    return true;
  },
  unregisterRider(riderId: string, socketId?: string): boolean {
    const current = riderSockets.get(riderId);
    if (socketId && current && current.id !== socketId) return false;
    riderSockets.delete(riderId);
    return true;
  },
  hasDriverSocket(driverId: string): boolean {
    return driverSockets.get(driverId)?.connected === true;
  },
  getDriverSocket(driverId: string): Socket | undefined {
    return driverSockets.get(driverId);
  },
  getRiderSocket(riderId: string): Socket | undefined {
    return riderSockets.get(riderId);
  },
  /** Snapshot of the in-memory socket registry, for liveness probes.
   *  Counts are per-process: behind a load balancer each instance reports only
   *  the sockets it owns, so a driver "connected" to another instance shows 0
   *  here. `entries` vs the live count exposes leaked registry rows — a gap
   *  means sockets were dropped without their disconnect handler running. */
  registryStats() {
    let drivers = 0;
    for (const s of driverSockets.values()) if (s.connected) drivers++;
    let riders = 0;
    for (const s of riderSockets.values()) if (s.connected) riders++;
    return {
      drivers,
      riders,
      driverEntries: driverSockets.size,
      riderEntries: riderSockets.size,
    };
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
    etaCache.delete(driverId);
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

  /** Cached wrapper around getEtaMinutes — at most one Distance Matrix call per
   *  driver per ETA_TTL_MS. Safe to call on every location ping. */
  async getEtaMinutesCached(
    driverId: string,
    driverLocation: { lat: number; lng: number },
    pickupCoords: { lat: number; lng: number },
  ): Promise<number> {
    const hit = etaCache.get(driverId);
    const now = Date.now();
    if (hit && now - hit.ts < ETA_TTL_MS) return hit.etaMin;

    const etaMin = await trackingService.getEtaMinutes(driverLocation, pickupCoords);
    etaCache.set(driverId, { ts: now, etaMin });
    return etaMin;
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
  emitToDriver(driverId: string, event: string, payload: unknown): boolean {
    const s = driverSockets.get(driverId);
    const io = getIO();
    console.log(`[tracking] emitToDriver driverId=${driverId} event=${event} directSocketFound=${!!s} ioReady=${!!io}`);
    if (s?.connected) {
      s.emit(event, payload);
      return true;
    }
    if (io) {
      // Room fallback, mirroring emitToRider: the gateway calls
      // socket.join('driver:{id}') on auth, so this still reaches a driver whose
      // map entry was clobbered by reconnect churn.
      console.log(`[tracking] emitToDriver falling back to room driver:${driverId}`);
      io.to(`driver:${driverId}`).emit(event, payload);
      return true;
    }
    console.log(`[tracking] emitToDriver DROPPED — no socket and no io instance`);
    return false;
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
