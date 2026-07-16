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

// DB row → shared `RiderDispute` shape consumed by @teeko/api.
function toDto(row: typeof disputes.$inferSelect) {
  return {
    id: row.id,
    tripId: row.tripId,
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

    const existing = await db.query.disputes.findFirst({
      where: and(eq(disputes.tripId, input.tripId), inArray(disputes.status, [...OPEN_STATUSES])),
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
};
