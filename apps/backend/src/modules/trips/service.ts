import { and, eq, inArray, not } from 'drizzle-orm';
import { db } from '../../db';
import { trips, tripEvents, fareQuotes, driverProfiles, vehicles, driverActiveVehicle, users } from '../../db/schema';
import { DomainError } from '../../shared/errors';
import { trackingService } from '../tracking/service';
import { env } from '../../config/env';

type Coords = { lat: number; lng: number };

export const tripsService = {
  // ---- rider: request ride ----
  async requestRide(
    riderId: string,
    quoteId: string,
    paymentMethodId: string | null,
    pickup: Coords,
    dest: Coords,
    pickupAddress: string | undefined,
    dropoffAddress: string | undefined,
    noteToDriver?: string,
  ) {
    // Prevent duplicate active trips
    const active = await db.query.trips.findFirst({
      where: and(
        eq(trips.riderId, riderId),
        not(inArray(trips.status, ['completed', 'cancelled', 'no_show'])),
      ),
    });
    if (active) throw new DomainError('ACTIVE_RIDE_EXISTS', 'You already have an active trip.', 409);

    // Validate quote exists and not expired
    const quote = await db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, quoteId) });
    if (!quote) throw new DomainError('QUOTE_NOT_FOUND', 'Fare quote not found.', 404);
    if (new Date(quote.expiresAt) < new Date()) {
      throw new DomainError('QUOTE_EXPIRED', 'Fare quote has expired. Please get a new quote.', 422);
    }

    const pickupWkt = `SRID=4326;POINT(${pickup.lng} ${pickup.lat})`;
    const dropoffWkt = `SRID=4326;POINT(${dest.lng} ${dest.lat})`;
    const [trip] = await db
      .insert(trips)
      .values({
        riderId,
        fareQuoteId: quoteId,
        status: 'requested',
        category: quote.category,
        pickup: pickupWkt,
        dropoff: dropoffWkt,
        pickupAddress,
        dropoffAddress,
        paymentMethodId,
        noteToDriver,
      })
      .returning();

    await db.insert(tripEvents).values({
      tripId: trip!.id,
      eventType: 'requested',
      actorId: riderId,
    });

    return trip!;
  },

  // ---- rider: cancel ----
  async riderCancelTrip(riderId: string, tripId: string, reasonCode: string) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip || trip.riderId !== riderId) {
      throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    }
    if (['completed', 'cancelled', 'no_show'].includes(trip.status)) {
      throw new DomainError('CANNOT_CANCEL', 'Trip is already finished.', 409);
    }

    // Cancellation fee if driver has been waiting at pickup > 5 min
    let feeCents = 0;
    if (trip.status === 'driver_arrived' && trip.driverArrivedAt) {
      const waitMs = Date.now() - new Date(trip.driverArrivedAt).getTime();
      if (waitMs > 5 * 60 * 1000) feeCents = env.CANCELLATION_FEE_CENTS;
    }

    await db
      .update(trips)
      .set({ status: 'cancelled', cancelReason: reasonCode, cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(trips.id, tripId));

    await db.insert(tripEvents).values({
      tripId,
      eventType: 'cancelled',
      actorId: riderId,
      payload: { by: 'rider', reasonCode, feeCents },
    });

    if (trip.driverId) {
      trackingService.emitToDriver(trip.driverId, 'trip.cancelled', {
        trip_id: tripId,
        cancelled_by: 'rider',
        reason: reasonCode,
      });
    }

    return { cancelled: true, feeCents };
  },

  // ---- rider: get trip status ----
  async getRideStatus(riderId: string, tripId: string) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip || trip.riderId !== riderId) {
      throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    }

    const driverLocation = trip.driverId
      ? await trackingService.getDriverLocation(trip.driverId)
      : null;

    const etaMin =
      driverLocation && trip.status === 'matched'
        ? await trackingService.getEtaMinutes(driverLocation, {
            lat: (trip.pickup as unknown as { y: number }).y,
            lng: (trip.pickup as unknown as { x: number }).x,
          })
        : null;

    return { trip, driverLocation, etaMin };
  },

  // ---- driver: accept ----
  async driverAcceptTrip(driverId: string, tripId: string) {
    const updated = await db.transaction(async (tx) => {
      const t = await tx.query.trips.findFirst({ where: eq(trips.id, tripId) });
      if (!t || t.status !== 'requested') {
        throw new DomainError('TRIP_NOT_AVAILABLE', 'Trip is no longer available.', 409);
      }
      const [row] = await tx
        .update(trips)
        .set({ driverId, status: 'matched', updatedAt: new Date() })
        .where(and(eq(trips.id, tripId), eq(trips.status, 'requested')))
        .returning();
      if (!row) throw new DomainError('TRIP_NOT_AVAILABLE', 'Trip was taken by another driver.', 409);
      return row;
    });

    await db.insert(tripEvents).values({
      tripId,
      eventType: 'accepted',
      actorId: driverId,
    });

    // Fetch driver details to include in socket payload so rider can display them immediately
    const [driverUser, driverProfile, activeVehicleRow] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, driverId) }),
      db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId) }),
      db.query.driverActiveVehicle.findFirst({ where: eq(driverActiveVehicle.driverId, driverId) }),
    ]);

    const vehicle = activeVehicleRow
      ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, activeVehicleRow.vehicleId) })
      : null;

    trackingService.emitToRider(updated.riderId, 'trip.status_update', {
      trip_id: tripId,
      status: 'matched',
      driver: {
        id: driverId,
        name: driverUser?.fullName ?? 'Driver',
        photoUrl: `https://i.pravatar.cc/150?u=${driverId}`,
        rating: driverProfile?.ratingAvg ? Number(driverProfile.ratingAvg) : 4.8,
        vehicle: vehicle
          ? { model: `${vehicle.make} ${vehicle.model}`, colour: vehicle.colour ?? '', seats: 4, category: vehicle.category }
          : { model: 'Unknown', colour: '', seats: 4, category: 'go' },
        plate: vehicle?.plateNumber ?? '',
        languages: ['ms', 'en'],
        phone: driverUser?.phone ?? '',
      },
    });

    return updated;
  },

  // ---- driver: decline ----
  async driverDeclineTrip(driverId: string, tripId: string) {
    await db.insert(tripEvents).values({
      tripId,
      eventType: 'declined',
      actorId: driverId,
    });
    return { ok: true };
  },

  // ---- driver: arrived at pickup ----
  async driverArrived(driverId: string, tripId: string) {
    const [updated] = await db
      .update(trips)
      .set({ status: 'driver_arrived', driverArrivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(trips.id, tripId), eq(trips.driverId, driverId), eq(trips.status, 'matched')))
      .returning();
    if (!updated) throw new DomainError('INVALID_TRANSITION', 'Cannot mark arrived from current state.', 422);

    await db.insert(tripEvents).values({ tripId, eventType: 'arrived', actorId: driverId });

    trackingService.emitToRider(updated.riderId, 'trip.status_update', {
      trip_id: tripId,
      status: 'driver_arrived',
    });

    return { waitTimerStart: updated.driverArrivedAt!.toISOString() };
  },

  // ---- driver: start trip ----
  async driverStartTrip(driverId: string, tripId: string) {
    const [updated] = await db
      .update(trips)
      .set({ status: 'in_trip', pickedUpAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(trips.id, tripId), eq(trips.driverId, driverId), eq(trips.status, 'driver_arrived')),
      )
      .returning();
    if (!updated) throw new DomainError('INVALID_TRANSITION', 'Cannot start trip from current state.', 422);

    await db.insert(tripEvents).values({ tripId, eventType: 'pickup', actorId: driverId });

    trackingService.emitToRider(updated.riderId, 'trip.status_update', {
      trip_id: tripId,
      status: 'in_trip',
    });

    return { ok: true };
  },

  // ---- driver: complete trip ----
  async driverCompleteTrip(driverId: string, tripId: string) {
    const trip = await db.query.trips.findFirst({
      where: and(eq(trips.id, tripId), eq(trips.driverId, driverId)),
    });
    if (!trip || trip.status !== 'in_trip') {
      throw new DomainError('INVALID_TRANSITION', 'Trip is not in progress.', 422);
    }

    // Look up fare from quote
    let quoteTotalCents = 0;
    if (trip.fareQuoteId) {
      const quote = await db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, trip.fareQuoteId) });
      quoteTotalCents = quote?.totalCents ?? 0;
    }
    const finalFareCents = quoteTotalCents;
    const commissionCents = Math.round(finalFareCents * env.COMMISSION_RATE);
    const netCents = finalFareCents - commissionCents;

    await db
      .update(trips)
      .set({ status: 'completed', finalFareCents, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(trips.id, tripId));

    await db.insert(tripEvents).values({ tripId, eventType: 'completed', actorId: driverId });

    // Increment driver total trips
    await db
      .update(driverProfiles)
      .set({ totalTrips: db.$count(trips, and(eq(trips.driverId, driverId), eq(trips.status, 'completed'))) as unknown as number })
      .where(eq(driverProfiles.userId, driverId))
      .catch(() => null);

    trackingService.emitToRider(trip.riderId, 'trip.status_update', {
      trip_id: tripId,
      status: 'completed',
    });

    return { finalFareCents, commissionCents, netCents, earningsCredited: true };
  },

  // ---- driver: cancel trip ----
  async driverCancelTrip(driverId: string, tripId: string, reasonCode: string) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip || trip.driverId !== driverId) {
      throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    }
    if (['completed', 'cancelled', 'no_show'].includes(trip.status)) {
      throw new DomainError('CANNOT_CANCEL', 'Trip is already finished.', 409);
    }

    await db
      .update(trips)
      .set({ status: 'cancelled', cancelReason: reasonCode, cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(trips.id, tripId));

    await db.insert(tripEvents).values({
      tripId,
      eventType: 'cancelled',
      actorId: driverId,
      payload: { by: 'driver', reasonCode },
    });

    trackingService.emitToRider(trip.riderId, 'trip.cancelled', {
      trip_id: tripId,
      cancelled_by: 'driver',
      reason: reasonCode,
    });

    return { ok: true };
  },

  // ---- rider: trip history ----
  async getRiderTrips(riderId: string) {
    return db.query.trips.findMany({
      where: eq(trips.riderId, riderId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 50,
    });
  },
};
