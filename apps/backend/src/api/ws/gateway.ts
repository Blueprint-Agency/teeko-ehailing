import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyRiderClerkToken, verifyDriverClerkToken } from '../../external/clerk';
import { findUserByExternalId } from '../../modules/identity/repo';
import { trackingService } from '../../modules/tracking/service';
import { db } from '../../db';
import { trips, driverProfiles, users, vehicles, driverActiveVehicle } from '../../db/schema';
import { and, eq, inArray } from 'drizzle-orm';

let io: Server | null = null;

export function mountSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    path: '/ws',
  });

  io.on('connection', async (socket: Socket) => {
    console.log(`[WS] connect  sid=${socket.id}`);

    // --- auth handshake ---
    socket.on('auth', async ({ token }: { token: string }) => {
      try {
        // Accept tokens from either the rider or driver Clerk instance.
        const claims = await verifyRiderClerkToken(token).catch(() => verifyDriverClerkToken(token));
        const user = await findUserByExternalId('clerk', claims.sub);
        console.log(`[WS] auth lookup clerkSub=${claims.sub} → dbUserId=${user?.id ?? 'NOT FOUND'} role=${user?.role}`);
        if (!user) { socket.disconnect(); return; }

        socket.data.userId = user.id;
        socket.data.role = user.role;

        if (user.role === 'driver') {
          trackingService.registerDriver(user.id, socket);
          socket.join(`driver:${user.id}`);
          socket.emit('auth.ok', { role: 'driver', userId: user.id });
          console.log(`[WS] auth.ok  driver userId=${user.id}`);
        } else {
          trackingService.registerRider(user.id, socket);
          socket.join(`rider:${user.id}`);
          socket.emit('auth.ok', { role: 'rider', userId: user.id });
          console.log(`[WS] auth.ok  rider  userId=${user.id}`);

          // Re-emit current trip status so rider recovers any missed event on reconnect
          const activeTrip = await db.query.trips.findFirst({
            where: and(
              eq(trips.riderId, user.id),
              inArray(trips.status, ['matched', 'driver_arrived', 'in_trip']),
            ),
          });
          if (activeTrip?.driverId) {
            const [driverUser, driverProfile, activeVehicleRow] = await Promise.all([
              db.query.users.findFirst({ where: eq(users.id, activeTrip.driverId) }),
              db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, activeTrip.driverId) }),
              db.query.driverActiveVehicle.findFirst({ where: eq(driverActiveVehicle.driverId, activeTrip.driverId) }),
            ]);
            const vehicle = activeVehicleRow
              ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, activeVehicleRow.vehicleId) })
              : null;
            socket.emit('trip.status_update', {
              trip_id: activeTrip.id,
              status: activeTrip.status,
              driver: {
                id: activeTrip.driverId,
                name: driverUser?.fullName ?? 'Driver',
                photoUrl: `https://i.pravatar.cc/150?u=${activeTrip.driverId}`,
                rating: driverProfile?.ratingAvg ? Number(driverProfile.ratingAvg) : 4.8,
                vehicle: vehicle ? {
                  plate: vehicle.plateNumber,
                  model: `${vehicle.make} ${vehicle.model}`,
                  color: vehicle.colour,
                } : null,
              },
            });
            console.log(`[WS] re-emitted trip.status_update status=${activeTrip.status} to rider userId=${user.id}`);
          }
        }
      } catch {
        socket.emit('auth.error', { message: 'invalid token' });
        socket.disconnect();
      }
    });

    // --- driver: location update during active trip ---
    socket.on('driver.location', async ({ lat, lng, heading }: { lat: number; lng: number; heading: number }) => {
      if (socket.data.role !== 'driver') return;
      const driverId: string = socket.data.userId;

      await trackingService.updateDriverLocation(driverId, lat, lng, heading);

      const activeTrip = await db.query.trips.findFirst({
        where: and(
          eq(trips.driverId, driverId),
          inArray(trips.status, ['matched', 'driver_arrived', 'in_trip']),
        ),
      });

      if (activeTrip) {
        const pickupLat = (activeTrip.pickup as unknown as { y: number }).y;
        const pickupLng = (activeTrip.pickup as unknown as { x: number }).x;
        const etaMin = await trackingService.getEtaMinutes(
          { lat, lng },
          { lat: pickupLat, lng: pickupLng },
        );
        trackingService.emitToRider(activeTrip.riderId, 'driver.location', { lat, lng, etaMin });
      }
    });

    // --- disconnect cleanup ---
    socket.on('disconnect', async () => {
      const { userId, role } = socket.data as { userId?: string; role?: string };
      console.log(`[WS] disconnect sid=${socket.id} userId=${userId ?? 'unauthed'}`);
      if (!userId) return;
      if (role === 'driver') {
        trackingService.unregisterDriver(userId);
        await trackingService.removeDriverLocation(userId);
      } else {
        trackingService.unregisterRider(userId);
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialised — call mountSocketIO first');
  return io;
}
