// modules/payments/repo.ts
// Drizzle queries for the payments domain: methods, the charge ledger, refunds,
// driver-earnings mirror, rider debt, and the webhook dedup table. Private to
// the module — routes go through the service.

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '../../config/db';
import { users } from '../../db/schema/identity';
import {
  connectAccounts,
  driverEarnings,
  paymentMethods,
  payments,
  refunds,
  riderDebt,
  webhookEvents,
} from '../../db/schema/payments';

export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
export type RefundRow = typeof refunds.$inferSelect;
export type PaymentMethodType = PaymentMethodRow['type'];
export type PaymentKind = PaymentRow['kind'];

// ---------- Stripe customer (rider) ----------

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true },
  });
  return row?.stripeCustomerId ?? null;
}

/** Existing customer id plus the profile fields used to seed a NEW Stripe
 * customer (name/email), fetched in one query. */
export async function getStripeCustomerSeed(userId: string): Promise<{
  stripeCustomerId: string | null;
  fullName: string | null;
  email: string | null;
}> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true, fullName: true, email: true },
  });
  return {
    stripeCustomerId: row?.stripeCustomerId ?? null,
    fullName: row?.fullName ?? null,
    email: row?.email ?? null,
  };
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
}

// ---------- payment methods ----------

export async function countMethods(userId: string): Promise<number> {
  return db.$count(
    paymentMethods,
    and(eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)),
  );
}

export async function insertMethod(data: {
  userId: string;
  type: PaymentMethodType;
  externalId: string | null;
  label: string | null;
  isDefault: boolean;
}): Promise<PaymentMethodRow> {
  const [row] = await db.insert(paymentMethods).values(data).returning();
  if (!row) throw new Error('insert payment_methods returned no row');
  return row;
}

export async function listMethods(userId: string): Promise<PaymentMethodRow[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
    .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));
}

export async function getMethodForUser(
  userId: string,
  id: string,
): Promise<PaymentMethodRow | undefined> {
  return db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.id, id),
      eq(paymentMethods.userId, userId),
      isNull(paymentMethods.deletedAt),
    ),
  });
}

export async function getMethod(id: string): Promise<PaymentMethodRow | undefined> {
  return db.query.paymentMethods.findFirst({ where: eq(paymentMethods.id, id) });
}

export async function getDefaultMethod(userId: string): Promise<PaymentMethodRow | undefined> {
  return db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.userId, userId),
      eq(paymentMethods.isDefault, true),
      isNull(paymentMethods.deletedAt),
    ),
  });
}

/** Clears the default flag on all of a user's methods, then sets it on `id`. */
export async function setDefaultMethod(userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.userId, userId));
    await tx
      .update(paymentMethods)
      .set({ isDefault: true })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
  });
}

export async function softDeleteMethod(id: string): Promise<void> {
  await db
    .update(paymentMethods)
    .set({ isDefault: false, deletedAt: new Date() })
    .where(eq(paymentMethods.id, id));
}

// ---------- payments ledger ----------

export async function insertPayment(data: {
  tripId?: string | null;
  riderId: string;
  driverId?: string | null;
  paymentMethodId?: string | null;
  kind: PaymentKind;
  methodType: PaymentMethodType;
  amountCents: number;
  commissionCents: number;
}): Promise<PaymentRow> {
  const [row] = await db
    .insert(payments)
    .values({ ...data, status: 'pending' })
    .returning();
  if (!row) throw new Error('insert payments returned no row');
  return row;
}

export async function updatePayment(
  id: string,
  patch: Partial<{
    status: PaymentRow['status'];
    stripePaymentIntentId: string | null;
    receiptUrl: string | null;
    failureCode: string | null;
  }>,
): Promise<PaymentRow | undefined> {
  const [row] = await db
    .update(payments)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(payments.id, id))
    .returning();
  return row;
}

export async function getPayment(id: string): Promise<PaymentRow | undefined> {
  return db.query.payments.findFirst({ where: eq(payments.id, id) });
}

export async function getPaymentByIntent(piId: string): Promise<PaymentRow | undefined> {
  return db.query.payments.findFirst({ where: eq(payments.stripePaymentIntentId, piId) });
}

export async function listPaymentsForTrip(tripId: string): Promise<PaymentRow[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.tripId, tripId))
    .orderBy(desc(payments.createdAt));
}

export async function listPaymentsForRider(
  riderId: string,
  limit = 50,
): Promise<PaymentRow[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.riderId, riderId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

// ---------- driver earnings mirror ----------

/** Idempotent: unique(trip_id) means a re-run (webhook + inline) is a no-op. */
export async function upsertEarning(data: {
  driverId: string;
  tripId: string;
  paymentId: string | null;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  transferred: boolean;
}): Promise<void> {
  await db.insert(driverEarnings).values(data).onConflictDoNothing({
    target: driverEarnings.tripId,
  });
}

// ---------- refunds ----------

export async function insertRefund(data: {
  paymentId: string;
  stripeRefundId: string | null;
  amountCents: number;
  reason: RefundRow['reason'];
  reversedTransfer: boolean;
  issuedBy: string | null;
}): Promise<RefundRow> {
  const [row] = await db
    .insert(refunds)
    .values({ ...data, status: 'pending' })
    .returning();
  if (!row) throw new Error('insert refunds returned no row');
  return row;
}

export async function getRefundByStripeId(
  stripeRefundId: string,
): Promise<RefundRow | undefined> {
  return db.query.refunds.findFirst({
    where: eq(refunds.stripeRefundId, stripeRefundId),
  });
}

export async function markRefundStatus(
  id: string,
  status: RefundRow['status'],
): Promise<void> {
  await db.update(refunds).set({ status }).where(eq(refunds.id, id));
}

export async function listRefundsForPayment(paymentId: string): Promise<RefundRow[]> {
  return db.select().from(refunds).where(eq(refunds.paymentId, paymentId));
}

// ---------- rider debt ----------

export async function openDebt(data: {
  riderId: string;
  paymentId: string | null;
  amountCents: number;
}): Promise<void> {
  await db.insert(riderDebt).values(data);
}

export async function getOpenDebtTotal(riderId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${riderDebt.amountCents}), 0)` })
    .from(riderDebt)
    .where(and(eq(riderDebt.riderId, riderId), eq(riderDebt.status, 'open')));
  return Number(rows[0]?.total ?? 0);
}

export async function settleAllDebt(riderId: string): Promise<void> {
  await db
    .update(riderDebt)
    .set({ status: 'settled', settledAt: new Date() })
    .where(and(eq(riderDebt.riderId, riderId), eq(riderDebt.status, 'open')));
}

// ---------- webhook dedup ----------

/** Returns true if this event is new (first time seen), false if a duplicate. */
export async function recordWebhookEvent(id: string, type: string): Promise<boolean> {
  const inserted = await db
    .insert(webhookEvents)
    .values({ id, type })
    .onConflictDoNothing({ target: webhookEvents.id })
    .returning({ id: webhookEvents.id });
  return inserted.length > 0;
}

// ---------- connect account (read-only; writes live in payouts repo) ----------

/** The driver's Stripe Connect account id for destination charges (spec §8). */
export async function getConnectAccountId(driverId: string): Promise<string | null> {
  const row = await db.query.connectAccounts.findFirst({
    where: eq(connectAccounts.driverId, driverId),
    columns: { stripeAccountId: true, status: true },
  });
  return row?.stripeAccountId ?? null;
}
