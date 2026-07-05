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

export type ConnectAccountRow = typeof connectAccounts.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;

// ---------- connect accounts ----------

export async function getConnectAccount(driverId: string): Promise<ConnectAccountRow | undefined> {
  return db.query.connectAccounts.findFirst({
    where: eq(connectAccounts.driverId, driverId),
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
    })
    .from(driverEarnings)
    .where(eq(driverEarnings.driverId, driverId))
    .orderBy(desc(driverEarnings.createdAt))
    .limit(limit);
}
