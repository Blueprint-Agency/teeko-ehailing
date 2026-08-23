// modules/payouts/repo.ts
// Drizzle queries for the payouts domain: Stripe Connect accounts, driver
// payouts, and reads over the driver-earnings mirror. Private to the module.

import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import {
  connectAccounts,
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
): Promise<EarningsSummary> {
  const where = since
    ? and(eq(driverEarnings.driverId, driverId), gte(driverEarnings.createdAt, since))
    : eq(driverEarnings.driverId, driverId);
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

export async function recentEarnings(driverId: string, limit = 20) {
  return db
    .select({
      tripId: driverEarnings.tripId,
      grossCents: driverEarnings.grossCents,
      commissionCents: driverEarnings.commissionCents,
      netCents: driverEarnings.netCents,
      transferred: driverEarnings.transferred,
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
    .where(eq(driverEarnings.driverId, driverId))
    .orderBy(desc(driverEarnings.createdAt))
    .limit(limit);
}

/**
 * Net earnings bucketed by Malaysian calendar day, for the dashboard chart.
 * Only days with earnings come back — the service pads the gaps.
 */
export async function dailyEarnings(
  driverId: string,
  since: Date,
): Promise<Array<{ day: string; netCents: number; tripCount: number }>> {
  const day = sql<string>`to_char((${driverEarnings.createdAt} AT TIME ZONE ${MYT})::date, 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day,
      netCents: sql<number>`coalesce(sum(${driverEarnings.netCents}), 0)`,
      tripCount: sql<number>`count(*)`,
    })
    .from(driverEarnings)
    .where(and(eq(driverEarnings.driverId, driverId), gte(driverEarnings.createdAt, since)))
    .groupBy(day)
    .orderBy(day);
  return rows.map((r) => ({
    day: r.day,
    netCents: Number(r.netCents),
    tripCount: Number(r.tripCount),
  }));
}
