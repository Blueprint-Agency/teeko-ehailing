// modules/payouts/repo.ts
// Drizzle queries for the payouts domain: Stripe Connect accounts, driver
// payouts, and reads over the driver-earnings mirror. Private to the module.

import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import {
  connectAccounts,
  driverBankAccounts,
  driverEarnings,
  payouts,
} from '../../db/schema/payments';
import { fareQuotes, trips } from '../../db/schema/trips';
import { users } from '../../db/schema/identity';

// Drivers read their earnings in Malaysian time; rows are stored in UTC.
// Postgres does the conversion so day boundaries match the driver's calendar.
const MYT = sql`'Asia/Kuala_Lumpur'`;

export type ConnectAccountRow = typeof connectAccounts.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;

// ---------- connect accounts ----------

export async function getConnectAccount(driverId: string): Promise<ConnectAccountRow | undefined> {
  return db.query.connectAccounts.findFirst({
    where: eq(connectAccounts.driverId, driverId),
  });
}

/**
 * Contact details Stripe pre-fills the hosted onboarding form with. Both
 * columns are nullable — a driver who signed up by phone has neither, and
 * Stripe simply collects them in the flow instead.
 */
export async function getDriverContact(
  driverId: string,
): Promise<{ email: string | null; fullName: string | null } | undefined> {
  return db.query.users.findFirst({
    where: eq(users.id, driverId),
    columns: { email: true, fullName: true },
  });
}

export async function getConnectByStripeId(
  stripeAccountId: string,
): Promise<ConnectAccountRow | undefined> {
  return db.query.connectAccounts.findFirst({
    where: eq(connectAccounts.stripeAccountId, stripeAccountId),
  });
}

export async function insertConnectAccount(data: {
  driverId: string;
  stripeAccountId: string;
}): Promise<ConnectAccountRow> {
  const [row] = await db.insert(connectAccounts).values(data).returning();
  if (!row) throw new Error('insert connect_accounts returned no row');
  return row;
}

export async function updateConnectByStripeId(
  stripeAccountId: string,
  patch: { status?: ConnectAccountRow['status']; payoutsEnabled?: boolean },
): Promise<void> {
  await db
    .update(connectAccounts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(connectAccounts.stripeAccountId, stripeAccountId));
}

// ---------- bank accounts ----------

/** The account finance transfers to, or undefined until the driver adds one. */
export async function getBankAccount(driverId: string) {
  return db.query.driverBankAccounts.findFirst({
    where: eq(driverBankAccounts.driverId, driverId),
  });
}

// ---------- payouts ----------

export async function insertPayout(data: {
  driverId: string;
  stripePayoutId: string | null;
  amountCents: number;
  method: PayoutRow['method'];
  arrivalDate?: Date | null;
}): Promise<PayoutRow> {
  const [row] = await db
    .insert(payouts)
    .values({ ...data, status: 'pending' })
    .returning();
  if (!row) throw new Error('insert payouts returned no row');
  return row;
}

export async function updatePayoutStatusByStripeId(
  stripePayoutId: string,
  status: PayoutRow['status'],
): Promise<void> {
  await db.update(payouts).set({ status }).where(eq(payouts.stripePayoutId, stripePayoutId));
}

export async function listPayouts(driverId: string, limit = 20): Promise<PayoutRow[]> {
  return db
    .select()
    .from(payouts)
    .where(eq(payouts.driverId, driverId))
    .orderBy(desc(payouts.createdAt))
    .limit(limit);
}

/** Most recent instant cashout time, for the once-per-24h cooldown (spec §12). */
export async function lastInstantCashoutAt(driverId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: payouts.createdAt })
    .from(payouts)
    .where(and(eq(payouts.driverId, driverId), eq(payouts.method, 'instant')))
    .orderBy(desc(payouts.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

// ---------- earnings reads ----------

export type EarningsSummary = {
  tripCount: number;
  grossCents: number;
  commissionCents: number;
  netCents: number;
};

export async function earningsSummary(
  driverId: string,
  since?: Date,
  /** Exclusive upper bound. Needed for prior-period comparisons, which are a
   *  closed window rather than "everything since". */
  until?: Date,
): Promise<EarningsSummary> {
  const where = and(
    eq(driverEarnings.driverId, driverId),
    ...(since ? [gte(driverEarnings.createdAt, since)] : []),
    ...(until ? [lt(driverEarnings.createdAt, until)] : []),
  );
  const rows = await db
    .select({
      tripCount: sql<number>`count(*)`,
      grossCents: sql<number>`coalesce(sum(${driverEarnings.grossCents}), 0)`,
      commissionCents: sql<number>`coalesce(sum(${driverEarnings.commissionCents}), 0)`,
      netCents: sql<number>`coalesce(sum(${driverEarnings.netCents}), 0)`,
    })
    .from(driverEarnings)
    .where(where);
  const r = rows[0];
  return {
    tripCount: Number(r?.tripCount ?? 0),
    grossCents: Number(r?.grossCents ?? 0),
    commissionCents: Number(r?.commissionCents ?? 0),
    netCents: Number(r?.netCents ?? 0),
  };
}

/**
 * Net earnings no payout has covered yet — what the driver's next bank
 * transfer will carry. Keyed on `payoutId`, not `transferred`: the latter
 * records the Stripe Connect transfer made at charge time, which says nothing
 * about whether the money has reached the driver's own bank.
 */
export async function unpaidNetCents(driverId: string): Promise<number> {
  const rows = await db
    .select({ netCents: sql<number>`coalesce(sum(${driverEarnings.netCents}), 0)` })
    .from(driverEarnings)
    .where(and(eq(driverEarnings.driverId, driverId), isNull(driverEarnings.payoutId)));
  return Number(rows[0]?.netCents ?? 0);
}

export async function recentEarnings(driverId: string, since?: Date, limit = 100) {
  return db
    .select({
      tripId: driverEarnings.tripId,
      grossCents: driverEarnings.grossCents,
      commissionCents: driverEarnings.commissionCents,
      netCents: driverEarnings.netCents,
      transferred: driverEarnings.transferred,
      // Whether a payout has actually carried this earning to the driver's
      // bank. `transferred` is *not* the same thing — it records the Connect
      // transfer made at charge time, which says nothing about the bank.
      paidOut: sql<boolean>`${driverEarnings.payoutId} is not null`,
      createdAt: driverEarnings.createdAt,
      // Trip context for the driver's history list. Left-joined so an earning
      // whose trip row was purged still shows its amount rather than vanishing.
      pickupAddress: trips.pickupAddress,
      dropoffAddress: trips.dropoffAddress,
      completedAt: trips.completedAt,
      riderRating: trips.riderRating,
      riderName: users.fullName,
      distanceMeters: fareQuotes.distanceMeters,
    })
    .from(driverEarnings)
    .leftJoin(trips, eq(trips.id, driverEarnings.tripId))
    .leftJoin(users, eq(users.id, trips.riderId))
    .leftJoin(fareQuotes, eq(fareQuotes.id, trips.fareQuoteId))
    .where(
      and(
        eq(driverEarnings.driverId, driverId),
        ...(since ? [gte(driverEarnings.createdAt, since)] : []),
      ),
    )
    .orderBy(desc(driverEarnings.createdAt))
    .limit(limit);
}

/**
 * Net earnings grouped into fixed-width time buckets, for the dashboard chart.
 * `hour` backs the day view (the service folds hours into blocks); `day` backs
 * the week and month views. Only buckets with earnings come back — the service
 * pads the gaps so the chart always renders a full set of columns.
 */
export async function bucketedEarnings(
  driverId: string,
  since: Date,
  bucket: 'hour' | 'day',
): Promise<Array<{ key: string; netCents: number; tripCount: number }>> {
  const local = sql`(${driverEarnings.createdAt} AT TIME ZONE ${MYT})`;
  // 'YYYY-MM-DDTHH' for hours, 'YYYY-MM-DD' for days — both sort lexically and
  // match the keys the service derives from the same Malaysian-time boundaries.
  const key =
    bucket === 'hour'
      ? sql<string>`to_char(date_trunc('hour', ${local}), 'YYYY-MM-DD"T"HH24')`
      : sql<string>`to_char(${local}::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      key,
      netCents: sql<number>`coalesce(sum(${driverEarnings.netCents}), 0)`,
      tripCount: sql<number>`count(*)`,
    })
    .from(driverEarnings)
    .where(and(eq(driverEarnings.driverId, driverId), gte(driverEarnings.createdAt, since)))
    .groupBy(key)
    .orderBy(key);
  return rows.map((r) => ({
    key: r.key,
    netCents: Number(r.netCents),
    tripCount: Number(r.tripCount),
  }));
}
