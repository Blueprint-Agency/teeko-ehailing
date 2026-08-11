import type { FastifyInstance } from 'fastify';
import type { Column } from 'drizzle-orm';
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { trips, disputes } from '../../db/schema/trips';
import { users, userRoles } from '../../db/schema/identity';
import { driverProfiles } from '../../db/schema/drivers';

// Malaysia market — "today" is a KL calendar day. KL has no DST, so a fixed
// literal timezone is safe and lets the same expression be reused in group-bys.
const TZ = 'Asia/Kuala_Lumpur';
const dayBucket = (col: Column) =>
  sql<string>`to_char(${col} AT TIME ZONE ${sql.raw(`'${TZ}'`)}, 'YYYY-MM-DD')`;

// Trips underway (a driver is assigned and the ride hasn't terminated) — mirrors
// LIVE_STATUSES in trips.routes.ts.
const LIVE_STATUSES = ['matched', 'driver_arrived', 'in_trip'] as const;

// Today + yesterday as KL date strings, so day filters match dayBucket() output.
function klDates() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const now = Date.now();
  return { today: fmt.format(new Date(now)), yesterday: fmt.format(new Date(now - 86_400_000)) };
}

// Percentage change vs a prior value; null when there's no baseline to compare to.
function deltaPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10; // one decimal place
}

export async function routes(app: FastifyInstance) {
  // ── GET /metrics/overview ──────────────────────────────────────────────────
  // Platform snapshot for the admin dashboard cards. Every figure is a live DB
  // aggregate; money is integer sen in the DB and returned as major-unit RM.
  app.get('/overview', async () => {
    const { today, yesterday } = klDates();
    // ISO string, not a Date: postgres-js can't serialize a bare Date param
    // interpolated into a raw sql`` fragment (unlike drizzle's typed operators).
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // Only bucket by KL day in select/group-by (never in a where clause — see
    // revenue.routes.ts); filter on the real timestamp column instead. `since`
    // reaches back two days so both today and yesterday (KL) are fully covered.
    const since = new Date(Date.now() - 2 * 86_400_000);

    const [
      activeTripRows,
      driverRows,
      tripAggRows,
      disputeRows,
      riderRows,
    ] = await Promise.all([
      // Trips currently on the road.
      db
        .select({ count: sql<number>`count(*)` })
        .from(trips)
        .where(inArray(trips.status, [...LIVE_STATUSES])),

      // Driver supply — how many are online vs. approved overall.
      db
        .select({
          online: sql<number>`count(*) filter (where ${driverProfiles.availability} in ('online', 'on_trip'))`,
          active: sql<number>`count(*) filter (where ${driverProfiles.approvalStatus} = 'approved')`,
        })
        .from(driverProfiles),

      // Recent trips bucketed by KL day + ride category. One scan feeds the
      // today/yesterday trip + revenue deltas and today's category breakdown.
      db
        .select({
          date: dayBucket(trips.createdAt),
          category: trips.category,
          trips: sql<number>`count(*)`,
          revenueCents: sql<number>`coalesce(sum(${trips.finalFareCents}) filter (where ${trips.status} = 'completed'), 0)`,
        })
        .from(trips)
        .where(gte(trips.createdAt, since))
        .groupBy(dayBucket(trips.createdAt), trips.category),

      // Disputes still needing a first look.
      db
        .select({ count: sql<number>`count(*)` })
        .from(disputes)
        .where(eq(disputes.status, 'open')),

      // Rider base + how many joined in the last 7 days.
      db
        .select({
          total: sql<number>`count(*)`,
          newThisWeek: sql<number>`count(*) filter (where ${users.createdAt} >= ${weekAgo})`,
        })
        .from(users)
        .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, 'rider')))
        .where(isNull(users.deletedAt)),
    ]);

    // Fold the per-(day, category) rows into today/yesterday totals and today's
    // category split.
    let todayTrips = 0, yesterdayTrips = 0;
    let todayRevenueCents = 0, yesterdayRevenueCents = 0;
    const todayByCategoryMap = new Map<string, number>();
    for (const r of tripAggRows) {
      const t = Number(r.trips);
      const rev = Number(r.revenueCents);
      if (r.date === today) {
        todayTrips += t;
        todayRevenueCents += rev;
        todayByCategoryMap.set(r.category, (todayByCategoryMap.get(r.category) ?? 0) + t);
      } else if (r.date === yesterday) {
        yesterdayTrips += t;
        yesterdayRevenueCents += rev;
      }
    }
    const todayRevenue = todayRevenueCents / 100;
    const yesterdayRevenue = yesterdayRevenueCents / 100;
    const todayByCategory = [...todayByCategoryMap.entries()]
      .map(([category, trips]) => ({ category, trips }))
      .sort((a, b) => b.trips - a.trips);

    return {
      activeTrips: Number(activeTripRows[0]?.count ?? 0),
      driversOnline: Number(driverRows[0]?.online ?? 0),
      activeDrivers: Number(driverRows[0]?.active ?? 0),
      todayTrips,
      todayTripsDeltaPct: deltaPct(todayTrips, yesterdayTrips),
      todayRevenue,
      todayRevenueDeltaPct: deltaPct(todayRevenue, yesterdayRevenue),
      openDisputes: Number(disputeRows[0]?.count ?? 0),
      totalRiders: Number(riderRows[0]?.total ?? 0),
      newRidersThisWeek: Number(riderRows[0]?.newThisWeek ?? 0),
      todayByCategory,
    };
  });
}
