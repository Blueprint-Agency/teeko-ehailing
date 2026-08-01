import type { FastifyInstance } from 'fastify';
import type { Column } from 'drizzle-orm';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { trips } from '../../db/schema/trips';
import { driverEarnings, payouts, refunds } from '../../db/schema/payments';

// Malaysia market — bucket money movements into local calendar days.
const TZ = 'Asia/Kuala_Lumpur';

// A timestamptz column → 'YYYY-MM-DD' string in local (KL) time. The timezone is
// inlined as a literal (not a bound param) on purpose: the identical expression is
// reused in select + groupBy, and Postgres only matches a GROUP BY expression to a
// SELECT one when they're textually identical — a bound param gets a different
// placeholder index in each spot, which breaks the match (error 42803). TZ is a
// hardcoded constant, so there's no injection surface.
const dayBucket = (col: Column) =>
  sql<string>`to_char(${col} AT TIME ZONE ${sql.raw(`'${TZ}'`)}, 'YYYY-MM-DD')`;

interface RevenueDay {
  date: string;
  trips: number;
  revenue: number;
  commissions: number;
  payouts: number;
  refunds: number;
}

// Contiguous list of the last `days` KL calendar days, oldest first. KL has no
// DST, so stepping UTC by 24h keeps the same local wall-clock and the date rolls
// over cleanly.
function daySpine(days: number): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // en-CA → YYYY-MM-DD
  const now = Date.now();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(fmt.format(new Date(now - i * 86_400_000)));
  return out;
}

export async function routes(app: FastifyInstance) {
  // ── GET /revenue/daily?days=30 ─────────────────────────────────────────────
  // Per-day financial series for the admin Revenue Reports charts. Each metric
  // lives in its own table (revenue/trips → trips, commissions → driver_earnings,
  // payouts → payouts, refunds → refunds), so we sum each independently and merge
  // by day in JS rather than fanning out a multi-way join. Amounts are stored as
  // integer sen; we return major-unit ringgit. Days with no activity are zero-
  // filled so the chart x-axis stays contiguous.
  app.get<{ Querystring: { days?: string } }>('/daily', async (req) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const [tripRows, commissionRows, payoutRows, refundRows] = await Promise.all([
      // Completed trips → revenue + trip count, keyed on completion day.
      db
        .select({
          date: dayBucket(trips.completedAt),
          trips: sql<number>`count(*)`,
          revenueCents: sql<number>`coalesce(sum(${trips.finalFareCents}), 0)`,
        })
        .from(trips)
        .where(and(eq(trips.status, 'completed'), gte(trips.completedAt, since)))
        .groupBy(dayBucket(trips.completedAt)),

      // Teeko's cut, mirrored one row per completed trip.
      db
        .select({
          date: dayBucket(driverEarnings.createdAt),
          commissionCents: sql<number>`coalesce(sum(${driverEarnings.commissionCents}), 0)`,
        })
        .from(driverEarnings)
        .where(gte(driverEarnings.createdAt, since))
        .groupBy(dayBucket(driverEarnings.createdAt)),

      // Driver bank payouts actually disbursed.
      db
        .select({
          date: dayBucket(payouts.createdAt),
          payoutCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)`,
        })
        .from(payouts)
        .where(and(eq(payouts.status, 'paid'), gte(payouts.createdAt, since)))
        .groupBy(dayBucket(payouts.createdAt)),

      // Money-ledger refunds (Stripe reversals) that succeeded.
      db
        .select({
          date: dayBucket(refunds.createdAt),
          refundCents: sql<number>`coalesce(sum(${refunds.amountCents}), 0)`,
        })
        .from(refunds)
        .where(and(eq(refunds.status, 'succeeded'), gte(refunds.createdAt, since)))
        .groupBy(dayBucket(refunds.createdAt)),
    ]);

    // Seed the contiguous spine, then fold each metric in by day.
    const byDay = new Map<string, RevenueDay>(
      daySpine(days).map((date) => [
        date,
        { date, trips: 0, revenue: 0, commissions: 0, payouts: 0, refunds: 0 },
      ]),
    );
    const rm = (cents: number) => Number(cents) / 100;

    for (const r of tripRows) {
      const d = byDay.get(r.date);
      if (d) { d.trips = Number(r.trips); d.revenue = rm(r.revenueCents); }
    }
    for (const r of commissionRows) {
      const d = byDay.get(r.date);
      if (d) d.commissions = rm(r.commissionCents);
    }
    for (const r of payoutRows) {
      const d = byDay.get(r.date);
      if (d) d.payouts = rm(r.payoutCents);
    }
    for (const r of refundRows) {
      const d = byDay.get(r.date);
      if (d) d.refunds = rm(r.refundCents);
    }

    return [...byDay.values()];
  });
}
