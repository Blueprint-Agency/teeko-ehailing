import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { disputes, trips } from '../../db/schema';
import { DomainError } from '../../shared/errors';

// Categories that carry a disputed money amount; amountMyr is ignored for the rest.
const MONEY_CATEGORIES = ['overcharge', 'payment'] as const;
type DisputeCategory = (typeof disputes.category.enumValues)[number];

// Non-terminal statuses — a trip may only have one dispute in these states.
const OPEN_STATUSES = ['open', 'under_review'] as const;

type CreateInput = {
  tripId: string;
  category: DisputeCategory;
  amountMyr?: number;
  description: string;
};

// A driver's report may be about their account rather than a trip, so tripId
// is optional here (see the driver Report Issue screen).
type CreateDriverInput = {
  tripId?: string | null;
  category: DisputeCategory;
  amountMyr?: number;
  description: string;
};

// DB row → shared `RiderDispute` / `DriverDispute` shape consumed by the apps.
function toDto(row: typeof disputes.$inferSelect) {
  return {
    id: row.id,
    tripId: row.tripId,
    raisedBy: row.raisedBy,
    category: row.category,
    status: row.status,
    amountMyr: row.amountCents != null ? row.amountCents / 100 : undefined,
    description: row.description,
    resolution: row.resolution ?? undefined,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString(),
  };
}

export const disputesService = {
  // ---- rider: raise a dispute on a finished trip ----
  async create(riderId: string, input: CreateInput) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
    if (!trip) throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    if (trip.riderId !== riderId) {
      throw new DomainError('FORBIDDEN', 'You do not have access to this trip.', 403);
    }
    if (!['completed', 'cancelled', 'no_show'].includes(trip.status)) {
      throw new DomainError('TRIP_NOT_DISPUTABLE', 'You can only dispute a finished trip.', 422);
    }

    // Scoped to rider-raised rows so a driver's report on the same trip
    // doesn't block the rider from raising theirs.
    const existing = await db.query.disputes.findFirst({
      where: and(
        eq(disputes.tripId, input.tripId),
        eq(disputes.raisedBy, 'rider'),
        inArray(disputes.status, [...OPEN_STATUSES]),
      ),
    });
    if (existing) {
      throw new DomainError('DISPUTE_EXISTS', 'This trip already has an open dispute.', 409);
    }

    const amountCents =
      MONEY_CATEGORIES.includes(input.category as (typeof MONEY_CATEGORIES)[number]) &&
      typeof input.amountMyr === 'number'
        ? Math.round(input.amountMyr * 100)
        : null;

    const [row] = await db
      .insert(disputes)
      .values({
        tripId: input.tripId,
        riderId,
        raisedBy: 'rider',
        category: input.category,
        description: input.description,
        amountCents,
      })
      .returning();

    return toDto(row!);
  },

  // ---- rider: list disputes for one of their trips ----
  async listForTrip(riderId: string, tripId: string) {
    const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
    if (!trip) throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
    if (trip.riderId !== riderId) {
      throw new DomainError('FORBIDDEN', 'You do not have access to this trip.', 403);
    }

    const rows = await db.query.disputes.findMany({
      where: eq(disputes.tripId, tripId),
      orderBy: [desc(disputes.createdAt)],
    });
    return rows.map(toDto);
  },

  // ---- rider: list every dispute they've raised (across all trips) ----
  async listForRider(riderId: string) {
    const rows = await db.query.disputes.findMany({
      where: eq(disputes.riderId, riderId),
      orderBy: [desc(disputes.createdAt)],
    });
    return rows.map(toDto);
  },

  // ---- driver: raise a dispute, optionally against one of their trips ----
  async createForDriver(driverId: string, input: CreateDriverInput) {
    if (input.tripId) {
      const trip = await db.query.trips.findFirst({ where: eq(trips.id, input.tripId) });
      if (!trip) throw new DomainError('TRIP_NOT_FOUND', 'Trip not found.', 404);
      if (trip.driverId !== driverId) {
        throw new DomainError('FORBIDDEN', 'You do not have access to this trip.', 403);
      }
      if (!['completed', 'cancelled', 'no_show'].includes(trip.status)) {
        throw new DomainError('TRIP_NOT_DISPUTABLE', 'You can only dispute a finished trip.', 422);
      }

      // Riders and drivers each get one open dispute per trip — a rider's open
      // dispute must not block the driver's side of the same trip.
      const existing = await db.query.disputes.findFirst({
        where: and(
          eq(disputes.tripId, input.tripId),
          eq(disputes.driverId, driverId),
          inArray(disputes.status, [...OPEN_STATUSES]),
        ),
      });
      if (existing) {
        throw new DomainError('DISPUTE_EXISTS', 'You already have an open report on this trip.', 409);
      }
    }

    const amountCents =
      MONEY_CATEGORIES.includes(input.category as (typeof MONEY_CATEGORIES)[number]) &&
      typeof input.amountMyr === 'number'
        ? Math.round(input.amountMyr * 100)
        : null;

    const [row] = await db
      .insert(disputes)
      .values({
        tripId: input.tripId ?? null,
        driverId,
        raisedBy: 'driver',
        category: input.category,
        description: input.description,
        amountCents,
      })
      .returning();

    return toDto(row!);
  },

  // ---- driver: list every dispute they've raised ----
  async listForDriver(driverId: string) {
    const rows = await db.query.disputes.findMany({
      where: eq(disputes.driverId, driverId),
      orderBy: [desc(disputes.createdAt)],
    });
    return rows.map(toDto);
  },
};
