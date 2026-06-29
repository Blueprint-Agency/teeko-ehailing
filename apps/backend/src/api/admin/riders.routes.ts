import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { users, userRoles } from '../../db/schema/identity';
import { riderProfiles } from '../../db/schema/riders';
import { trips } from '../../db/schema/trips';

export async function routes(app: FastifyInstance) {
  app.get('/', async () => {
    const tripAgg = db
      .select({
        riderId: trips.riderId,
        tripCount: sql<number>`count(*) filter (where ${trips.status} = 'completed')`.as('trip_count'),
        spentCents:
          sql<number>`coalesce(sum(${trips.finalFareCents}) filter (where ${trips.status} = 'completed'), 0)`.as(
            'spent_cents',
          ),
      })
      .from(trips)
      .groupBy(trips.riderId)
      .as('trip_agg');

    const rows = await db
      .select({
        id: users.id,
        name: users.fullName,
        phone: users.phone,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        ratingAvg: riderProfiles.ratingAvg,
        tripCount: tripAgg.tripCount,
        spentCents: tripAgg.spentCents,
      })
      .from(users)
      .innerJoin(
        userRoles,
        and(eq(userRoles.userId, users.id), eq(userRoles.role, 'rider')),
      )
      .leftJoin(riderProfiles, eq(riderProfiles.userId, users.id))
      .leftJoin(tripAgg, eq(tripAgg.riderId, users.id))
      .orderBy(desc(users.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? '—',
      phone: r.phone ?? '—',
      email: r.email ?? '—',
      // City is not yet captured on the rider profile.
      city: '—',
      // `deactivated` reads better as "inactive" in the admin chip palette.
      status: r.status === 'deactivated' ? 'inactive' : r.status,
      trips: Number(r.tripCount ?? 0),
      joinDate: r.createdAt ? r.createdAt.toISOString().slice(0, 10) : null,
      // Escalation levels aren't tracked yet; surface a neutral default.
      escalation: 0,
      rating: r.ratingAvg ? Number(r.ratingAvg) : 0,
      totalSpent: Math.round(Number(r.spentCents ?? 0) / 100),
    }));
  });
}
