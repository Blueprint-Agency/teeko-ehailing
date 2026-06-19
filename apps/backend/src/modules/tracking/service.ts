import type { Socket } from 'socket.io';
import { redis } from '../../config/redis';
import { getDistanceMatrix } from '../../external/googleMaps';
import { getIO } from '../../config/socketio';

// In-memory socket maps — replaced by Redis adapter in multi-instance prod
const driverSockets = new Map<string, Socket>();
const riderSockets = new Map<string, Socket>();

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
      .expire(`driver:location:${driverId}`, 30)
      .geoadd('driver:locations', lng, lat, driverId)
      .exec()
      .catch(() => null); // Redis optional — degrade gracefully
  },

  async removeDriverLocation(driverId: string): Promise<void> {
    await redis
      .pipeline()
      .del(`driver:location:${driverId}`)
      .zrem('driver:locations', driverId)
      .exec()
      .catch(() => null);
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
