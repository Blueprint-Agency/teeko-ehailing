import { and, eq, inArray, not } from 'drizzle-orm';
import { db } from '../../db';
import { trips, tripEvents, tripOffers, tripLocationPoints, fareQuotes, fareLines, cancellations, noShowFees, paymentMethods, driverProfiles, vehicles, driverActiveVehicle, users } from '../../db/schema';
import { DomainError } from '../../shared/errors';
import type { RedeemedQuote } from '../pricing/service';
import { trackingService } from '../tracking/service';
import { paymentsService } from '../payments/service';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

type Coords = { lat: number; lng: number };

// PostGIS geography may be returned as { x: lng, y: lat } (pg object) or WKT string.
function parsePoint(raw: unknown): Coords {
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const lat = Number(o['y']);
    const lng = Number(o['x']);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  const m = String(raw).match(/POINT\(([^ ]+) ([^ )]+)\)/);
  return m ? { lat: parseFloat(m[2]!), lng: parseFloat(m[1]!) } : { lat: 0, lng: 0 };
}

export const tripsService = {
  // ---- rider: request ride ----
  /**
   * Create a trip from an already-redeemed quote.
   *
   * The caller must obtain `quote` from `pricingService.redeemQuote`, which is
   * the single place quote ownership, category, expiry and single-use are
   * enforced. Taking the row (not an id) keeps that check from being duplicated
   * here — an earlier second check re-fetched the same row and reported expiry
   * as 422 while redeemQuote reports 410.
   */
  async requestRide(
    riderId: string,
    quote: RedeemedQuote,
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

    const quoteId = quote.id;
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
        ? await trackingService.getEtaMinutes(driverLocation, parsePoint(trip.pickup))
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

    // Clear the dispatch offer so the 15-second timeout doesn't fire after accept.
    // Without this the timeout sees offer:current still set, emits trip.request.timeout
    // to the driver and trip.no_drivers to the rider even though the trip is matched.
    await Promise.all([
      redis.del(`offer:${tripId}:current`).catch(() => null),
      db.update(tripOffers)
        .set({ status: 'terminal', outcome: 'accepted', resolvedAt: new Date() })
        .where(and(
          eq(tripOffers.tripId, tripId),
          eq(tripOffers.driverId, driverId),
          eq(tripOffers.status, 'pending'),
        ))
        .catch(() => null),
    ]);

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

    // Charge the rider off-session and write the ledger + driver earnings
    // (spec §8). Never let a charge failure block completion — a decline
    // becomes rider debt while the driver is still paid (spec §11).
    await paymentsService
      .chargeTripFare(
        {
          id: trip.id,
          riderId: trip.riderId,
          driverId: trip.driverId,
          paymentMethodId: trip.paymentMethodId,
          category: trip.category,
        },
        finalFareCents,
      )
      .catch((err) => {
        logger.error({ err, tripId }, 'trip fare charge errored');
        return null;
      });

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

  // ---- driver: get active trip (for crash recovery) ----
  async getDriverActiveTrip(driverId: string) {
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.driverId, driverId),
        not(inArray(trips.status, ['completed', 'cancelled', 'no_show'])),
      ),
    });
    if (!trip) return null;

    const [quote, rider] = await Promise.all([
      trip.fareQuoteId
        ? db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, trip.fareQuoteId) })
        : Promise.resolve(null),
      db.query.users.findFirst({ where: eq(users.id, trip.riderId) }),
    ]);

    const pickup = parsePoint(trip.pickup);
    const dropoff = parsePoint(trip.dropoff);

    return {
      tripId: trip.id,
      status: trip.status,
      category: trip.category,
      pickup: { ...pickup, address: trip.pickupAddress ?? '' },
      destination: { ...dropoff, address: trip.dropoffAddress ?? '' },
      fareCents: quote?.totalCents ?? 0,
      riderName: rider?.fullName ?? 'Rider',
      countdownSeconds: 0,
    };
  },

  // ---- rider: get active trip (session restore + polling fallback) ----
  async getRiderActiveTrip(riderId: string) {
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.riderId, riderId),
        not(inArray(trips.status, ['completed', 'cancelled', 'no_show'])),
      ),
    });
    if (!trip) return null;

    const [quote, driverUser, driverProfile, activeVehicleRow] = await Promise.all([
      trip.fareQuoteId
        ? db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, trip.fareQuoteId) })
        : Promise.resolve(null),
      trip.driverId
        ? db.query.users.findFirst({ where: eq(users.id, trip.driverId) })
        : Promise.resolve(null),
      trip.driverId
        ? db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, trip.driverId) })
        : Promise.resolve(null),
      trip.driverId
        ? db.query.driverActiveVehicle.findFirst({ where: eq(driverActiveVehicle.driverId, trip.driverId) })
        : Promise.resolve(null),
    ]);

    const vehicle = activeVehicleRow
      ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, activeVehicleRow.vehicleId) })
      : null;

    const pickupCoords = parsePoint(trip.pickup);
    const dropoffCoords = parsePoint(trip.dropoff);

    const CLIENT_STATUS: Record<string, string> = {
      requested: 'searching',
      matched: 'matched',
      driver_arrived: 'arrived',
      in_trip: 'in_trip',
      completed: 'completed',
      cancelled: 'cancelled',
    };

    return {
      tripId: trip.id,
      clientStatus: CLIENT_STATUS[trip.status] ?? trip.status,
      rideType: trip.category,
      pickup: { id: '', name: trip.pickupAddress ?? '', address: trip.pickupAddress ?? '', lat: pickupCoords.lat, lng: pickupCoords.lng },
      destination: { id: '', name: trip.dropoffAddress ?? '', address: trip.dropoffAddress ?? '', lat: dropoffCoords.lat, lng: dropoffCoords.lng },
      fare: { rideType: trip.category, amountMyr: (quote?.totalCents ?? 0) / 100, etaMin: 0 },
      driver: trip.driverId && driverUser
        ? {
            id: trip.driverId,
            name: driverUser.fullName ?? 'Driver',
            photoUrl: `https://i.pravatar.cc/150?u=${trip.driverId}`,
            rating: driverProfile?.ratingAvg ? Number(driverProfile.ratingAvg) : 4.8,
            vehicle: vehicle
              ? { model: `${vehicle.make} ${vehicle.model}`, colour: vehicle.colour ?? '', seats: 4, category: vehicle.category }
              : { model: 'Vehicle', colour: '', seats: 4, category: trip.category },
            plate: vehicle?.plateNumber ?? '',
            languages: ['ms', 'en'],
            phone: driverUser.phone ?? '',
          }
        : null,
      paymentMethodId: trip.paymentMethodId ?? '',
      createdAt: trip.createdAt.toISOString(),
    };
  },

  // ---- rider: trip history ----
  // Returns the rider's 50 most recent trips mapped to the shared `Trip` shape
  // consumed by @teeko/api (client/trips.ts `history()` → trip-store `history`).
  async getRiderTrips(riderId: string) {
    const rows = await db.query.trips.findMany({
      where: eq(trips.riderId, riderId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 50,
    });
    if (rows.length === 0) return [];

    // Batch-load fare quotes so we can show the quoted total when a trip has no
    // final fare yet (e.g. cancelled before completion).
    const quoteIds = [...new Set(rows.map((r) => r.fareQuoteId).filter((id): id is string => !!id))];
    const quotes = quoteIds.length
      ? await db.query.fareQuotes.findMany({ where: inArray(fareQuotes.id, quoteIds) })
      : [];
    const quoteById = new Map(quotes.map((q) => [q.id, q]));

    const CLIENT_STATUS: Record<string, string> = {
      requested: 'searching',
      matched: 'matched',
      driver_arrived: 'arrived',
      in_trip: 'in_trip',
      completed: 'completed',
      cancelled: 'cancelled',
      no_show: 'cancelled',
    };

    return rows.map((trip) => {
      const pickup = parsePoint(trip.pickup);
      const dropoff = parsePoint(trip.dropoff);
      const quote = trip.fareQuoteId ? quoteById.get(trip.fareQuoteId) : null;
      const fareCents = trip.finalFareCents ?? quote?.totalCents ?? 0;
      return {
        id: trip.id,
        status: CLIENT_STATUS[trip.status] ?? trip.status,
        riderId: trip.riderId,
        pickup: { id: '', name: trip.pickupAddress ?? '', address: trip.pickupAddress ?? '', lat: pickup.lat, lng: pickup.lng },
        destination: { id: '', name: trip.dropoffAddress ?? '', address: trip.dropoffAddress ?? '', lat: dropoff.lat, lng: dropoff.lng },
        rideType: trip.category,
        fare: { rideType: trip.category, amountMyr: fareCents / 100, etaMin: 0 },
        paymentMethodId: trip.paymentMethodId ?? '',
        routePolyline: [],
        createdAt: trip.createdAt.toISOString(),
        completedAt: trip.completedAt?.toISOString(),
        cancelledAt: trip.cancelledAt?.toISOString(),
        cancelReason: trip.cancelReason ?? undefined,
        rating: trip.riderRating ?? undefined,
        comment: trip.riderComment ?? undefined,
      };
    });
  },

  // ---- rider: trip detail / receipt ----
  // Returns full receipt data (fare breakdown, driver, payment, rating) for a
  // single trip the rider owns. Shape matches shared `TripReceipt`.
  async getRiderTripDetail(tripId: string, riderId: string) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip) throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    if (trip.riderId !== riderId) {
      throw new DomainError('FORBIDDEN', 'You do not have access to this trip.', 403);
    }

    const [quote, driverUser, driverProfile, pm, cancellation, noShow] = await Promise.all([
      trip.fareQuoteId
        ? db.query.fareQuotes.findFirst({ where: eq(fareQuotes.id, trip.fareQuoteId) })
        : Promise.resolve(null),
      trip.driverId
        ? db.query.users.findFirst({ where: eq(users.id, trip.driverId) })
        : Promise.resolve(null),
      trip.driverId
        ? db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, trip.driverId) })
        : Promise.resolve(null),
      trip.paymentMethodId
        ? db.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, trip.paymentMethodId) })
        : Promise.resolve(null),
      db.query.cancellations.findFirst({ where: eq(cancellations.tripId, tripId) }),
      db.query.noShowFees.findFirst({ where: eq(noShowFees.tripId, tripId) }),
    ]);

    // Vehicle: prefer the one recorded on the trip, else the driver's active one.
    let vehicle = trip.vehicleId
      ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, trip.vehicleId) })
      : null;
    if (!vehicle && trip.driverId) {
      const activeVehicleRow = await db.query.driverActiveVehicle.findFirst({
        where: eq(driverActiveVehicle.driverId, trip.driverId),
      });
      vehicle = activeVehicleRow
        ? (await db.query.vehicles.findFirst({ where: eq(vehicles.id, activeVehicleRow.vehicleId) })) ?? null
        : null;
    }

    // Fare breakdown: prefer per-trip lines, fall back to the quote's lines.
    let lines = await db.query.fareLines.findMany({ where: eq(fareLines.tripId, tripId) });
    if (lines.length === 0 && trip.fareQuoteId) {
      lines = await db.query.fareLines.findMany({ where: eq(fareLines.quoteId, trip.fareQuoteId) });
    }

    const pickup = parsePoint(trip.pickup);
    const dropoff = parsePoint(trip.dropoff);
    const fareCents = trip.finalFareCents ?? quote?.totalCents ?? 0;

    const fareLineItems = lines.length
      ? lines.map((l) => ({ kind: l.kind, amountMyr: l.amountCents / 100 }))
      : [{ kind: 'base' as const, amountMyr: fareCents / 100 }];
    if (trip.tipCents > 0 && !lines.some((l) => l.kind === 'tip')) {
      fareLineItems.push({ kind: 'tip', amountMyr: trip.tipCents / 100 });
    }

    const CLIENT_STATUS: Record<string, string> = {
      requested: 'searching',
      matched: 'matched',
      driver_arrived: 'arrived',
      in_trip: 'in_trip',
      completed: 'completed',
      cancelled: 'cancelled',
      no_show: 'cancelled',
    };

    const feeCents = cancellation?.feeCents || noShow?.amountCents || 0;

    return {
      id: trip.id,
      status: CLIENT_STATUS[trip.status] ?? trip.status,
      rideType: trip.category,
      pickup: { id: '', name: trip.pickupAddress ?? '', address: trip.pickupAddress ?? '', lat: pickup.lat, lng: pickup.lng },
      destination: { id: '', name: trip.dropoffAddress ?? '', address: trip.dropoffAddress ?? '', lat: dropoff.lat, lng: dropoff.lng },
      fareMyr: fareCents / 100,
      fareLines: fareLineItems,
      paymentLabel: pm?.label ?? (pm?.type ? pm.type : 'Cash'),
      cancellationFeeMyr: feeCents > 0 ? feeCents / 100 : undefined,
      driver: trip.driverId && driverUser
        ? {
            id: trip.driverId,
            name: driverUser.fullName ?? 'Driver',
            photoUrl: `https://i.pravatar.cc/150?u=${trip.driverId}`,
            rating: driverProfile?.ratingAvg ? Number(driverProfile.ratingAvg) : 4.8,
            vehicle: vehicle
              ? { model: `${vehicle.make} ${vehicle.model}`, colour: vehicle.colour ?? '', seats: 4, category: vehicle.category }
              : { model: 'Vehicle', colour: '', seats: 4, category: trip.category },
            plate: vehicle?.plateNumber ?? '',
            languages: ['ms', 'en'],
            phone: driverUser.phone ?? '',
          }
        : undefined,
      rating: trip.riderRating ?? undefined,
      comment: trip.riderComment ?? undefined,
      createdAt: trip.createdAt.toISOString(),
      completedAt: trip.completedAt?.toISOString(),
      cancelledAt: trip.cancelledAt?.toISOString(),
      cancelReason: trip.cancelReason ?? undefined,
    };
  },

  // ---- rider: rate a completed trip ----
  async rateTrip(riderId: string, tripId: string, rating: number, comment?: string) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip) throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    if (trip.riderId !== riderId) {
      throw new DomainError('FORBIDDEN', 'You do not have access to this trip.', 403);
    }
    if (trip.status !== 'completed') {
      throw new DomainError('TRIP_NOT_COMPLETED', 'You can only rate a completed trip.', 422);
    }

    const [updated] = await db
      .update(trips)
      .set({ riderRating: rating, riderComment: comment ?? null, ratedAt: new Date(), updatedAt: new Date() })
      .where(eq(trips.id, tripId))
      .returning();

    return { rating: updated!.riderRating, comment: updated!.riderComment };
  },

  // ---- trip route (recorded breadcrumbs) ----
  // Returns the ordered GPS breadcrumbs persisted during the trip. `requesterId`
  // must be the trip's rider or driver (admin callers pass requireOwner=false).
  async getTripRoute(tripId: string, requesterId: string, requireOwner = true) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip) throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    if (requireOwner && trip.riderId !== requesterId && trip.driverId !== requesterId) {
      throw new DomainError('FORBIDDEN', 'You do not have access to this trip.', 403);
    }

    const points = await db.query.tripLocationPoints.findMany({
      where: eq(tripLocationPoints.tripId, tripId),
      orderBy: (p, { asc }) => [asc(p.recordedAt)],
    });

    return {
      tripId,
      status: trip.status,
      points: points.map((p) => {
        const { lat, lng } = parsePoint(p.location);
        return {
          lat,
          lng,
          heading: p.heading !== null ? Number(p.heading) : null,
          speed: p.speed !== null ? Number(p.speed) : null,
          recordedAt: p.recordedAt.toISOString(),
        };
      }),
    };
  },
};
