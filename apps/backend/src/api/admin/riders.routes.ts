import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { users, userRoles } from '../../db/schema/identity';
import { riderProfiles } from '../../db/schema/riders';
import { trips } from '../../db/schema/trips';

type RiderRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  trips: number;
  joinDate: string | null;
  escalation: number;
  rating: number;
  totalSpent: number;
};

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
      .where(isNull(users.deletedAt))
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

  // Create a rider — provisions a user, the rider role, and an empty profile.
  app.post<{ Body: { name?: string; phone?: string; email?: string } }>(
    '/',
    async (req, reply) => {
      const name = req.body?.name?.trim();
      const phone = req.body?.phone?.trim() || null;
      const email = req.body?.email?.trim() || null;

      if (!name) return reply.code(400).send({ error: 'name_required' });

      // Phone is unique — reject duplicates with a clear conflict before insert.
      if (phone) {
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, phone))
          .limit(1);
        if (existing.length > 0) {
          return reply.code(409).send({ error: 'phone_in_use' });
        }
      }

      const rider = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ fullName: name, phone, email })
          .returning({ id: users.id, createdAt: users.createdAt });
        if (!user) throw new Error('insert users returned no row');

        await tx.insert(userRoles).values({ userId: user.id, role: 'rider' });
        await tx.insert(riderProfiles).values({ userId: user.id });

        return user;
      });

      const body: RiderRow = {
        id: rider.id,
        name,
        phone: phone ?? '—',
        email: email ?? '—',
        city: '—',
        status: 'active',
        trips: 0,
        joinDate: rider.createdAt ? rider.createdAt.toISOString().slice(0, 10) : null,
        escalation: 0,
        rating: 0,
        totalSpent: 0,
      };
      return reply.code(201).send(body);
    },
  );

  // Soft-delete a rider — stamps deletedAt so trip history stays intact.
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params;

    // Guard: only soft-delete users that actually hold the rider role.
    const [rider] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(
        userRoles,
        and(eq(userRoles.userId, users.id), eq(userRoles.role, 'rider')),
      )
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    if (!rider) return reply.code(404).send({ error: 'rider_not_found' });

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));

    return reply.send({ ok: true });
  });
}
