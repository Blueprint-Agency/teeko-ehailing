import { sql, type Column } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { trips } from './trips';

// Local helper: partial-unique `WHERE col IS NOT NULL` predicate. Kept inline
// so the schema file has no cross-import; mirrors the raw SQL in spec §16.
function sqlNotNull(col: Column) {
  return sql`${col} IS NOT NULL`;
}

// ---------------------------------------------------------------------------
// Payment system — v1.0 production design (teeko-payment-system.md).
//
// Money is stored as integer *Cents (sen), matching the rest of the schema
// (finalFareCents, baseCents, …). Stripe API calls use the same integer sen.
// Ledger-first: every money movement is a row; balances are never re-derived
// from Stripe. Idempotency is enforced by partial-unique indexes on the
// provider ids plus a webhook_events dedup table (see spec §14).
// ---------------------------------------------------------------------------

// A saved payment method's type. 'cash' is a Malaysia-market extension (driver
// collects; no online charge) kept for parity with the rider app; 'card' and
// 'google_pay' route through Stripe, 'tng' through the TNG eWallet SDK.
export const paymentMethodType = pgEnum('payment_method_type', [
  'cash',
  'card',
  'tng',
  'google_pay',
]);

// What a payments row represents.
export const paymentKind = pgEnum('payment_kind', [
  'trip_fare',
  'cancellation_fee',
  'debt_settlement',
  'tip',
]);

// Charge lifecycle. 'requires_action' = 3DS pending on the rider's device.
export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'requires_action',
  'failed',
  'refunded',
  'partially_refunded',
]);

export const refundReason = pgEnum('refund_reason', [
  'rider_complaint',
  'driver_fault',
  'overcharge',
  'duplicate',
]);

export const refundStatus = pgEnum('refund_status', ['pending', 'succeeded', 'failed']);

export const connectAccountStatus = pgEnum('connect_account_status', [
  'onboarding',
  'active',
  'restricted',
]);

export const payoutStatus = pgEnum('payout_status', ['pending', 'paid', 'failed']);
export const payoutMethod = pgEnum('payout_method', ['standard', 'instant']);

export const riderDebtStatus = pgEnum('rider_debt_status', [
  'open',
  'settled',
  'written_off',
]);

// ---------------------------------------------------------------------------
// Rider payment methods — device-tokenized; no raw PANs (PCI SAQ-A).
// ---------------------------------------------------------------------------
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: paymentMethodType().notNull(),
    // Stripe pm_xxx for card/google_pay, or the TNG reusable agreement id.
    // null for 'cash'.
    externalId: text(),
    label: text(), // 'VISA •••• 4242'
    isDefault: boolean().notNull().default(false),
    deletedAt: timestamp({ withTimezone: true }), // soft delete; history keeps FK
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_pm_user').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Rider charge ledger — one row per money pull. Source of truth for our books.
// ---------------------------------------------------------------------------
export const payments = pgTable(
  'payments',
  {
    id: uuid().primaryKey().defaultRandom(),
    tripId: uuid().references(() => trips.id),
    riderId: uuid()
      .notNull()
      .references(() => users.id),
    driverId: uuid().references(() => users.id),
    paymentMethodId: uuid().references(() => paymentMethods.id),
    kind: paymentKind().notNull(),
    methodType: paymentMethodType().notNull(), // snapshot of pm.type at charge time
    amountCents: integer().notNull(), // total charged to rider
    commissionCents: integer().notNull().default(0), // Teeko's cut, frozen here
    currency: text().notNull().default('myr'),
    status: paymentStatus().notNull().default('pending'),
    stripePaymentIntentId: text(), // pi_xxx
    receiptUrl: text(),
    failureCode: text(), // Stripe decline_code on failure
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Idempotency backstop — a duplicate PI insert is a no-op, not a double credit.
    uniqueIndex('uq_payments_pi')
      .on(t.stripePaymentIntentId)
      .where(sqlNotNull(t.stripePaymentIntentId)),
    index('idx_payments_rider').on(t.riderId, t.createdAt),
    index('idx_payments_trip').on(t.tripId),
    index('idx_payments_status').on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Refunds — partial or full reversals of a payment.
// ---------------------------------------------------------------------------
export const refunds = pgTable(
  'refunds',
  {
    id: uuid().primaryKey().defaultRandom(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id),
    stripeRefundId: text(),
    amountCents: integer().notNull(),
    reason: refundReason().notNull(),
    reversedTransfer: boolean().notNull().default(false), // true = clawed from driver
    status: refundStatus().notNull().default('pending'),
    issuedBy: uuid().references(() => users.id), // admin (audit)
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_refunds_stripe')
      .on(t.stripeRefundId)
      .where(sqlNotNull(t.stripeRefundId)),
  ],
);

// ---------------------------------------------------------------------------
// Driver earnings mirror — one row per completed trip. With destination
// charges the net is already in the driver's Stripe balance; this is our
// mirror for the dashboard and reconciliation.
// ---------------------------------------------------------------------------
export const driverEarnings = pgTable(
  'driver_earnings',
  {
    id: uuid().primaryKey().defaultRandom(),
    driverId: uuid()
      .notNull()
      .references(() => users.id),
    tripId: uuid()
      .notNull()
      .references(() => trips.id),
    paymentId: uuid().references(() => payments.id),
    grossCents: integer().notNull(),
    commissionCents: integer().notNull(),
    netCents: integer().notNull(),
    transferred: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_earning_trip').on(t.tripId), // one earning per trip
    index('idx_earning_driver').on(t.driverId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Driver Stripe Connect accounts — Stripe holds bank + KYC, not Teeko.
// ---------------------------------------------------------------------------
export const connectAccounts = pgTable('connect_accounts', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeAccountId: text().notNull().unique(),
  status: connectAccountStatus().notNull().default('onboarding'),
  payoutsEnabled: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Driver payouts to bank (instant cashouts + scheduled).
// ---------------------------------------------------------------------------
export const payouts = pgTable(
  'payouts',
  {
    id: uuid().primaryKey().defaultRandom(),
    driverId: uuid()
      .notNull()
      .references(() => users.id),
    stripePayoutId: text(),
    amountCents: integer().notNull(),
    method: payoutMethod().notNull().default('standard'),
    status: payoutStatus().notNull().default('pending'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_payouts_stripe')
      .on(t.stripePayoutId)
      .where(sqlNotNull(t.stripePayoutId)),
    index('idx_payouts_driver').on(t.driverId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Outstanding rider balance from failed off-session charges (spec §11).
// ---------------------------------------------------------------------------
export const riderDebt = pgTable(
  'rider_debt',
  {
    id: uuid().primaryKey().defaultRandom(),
    riderId: uuid()
      .notNull()
      .references(() => users.id),
    paymentId: uuid().references(() => payments.id), // the charge that failed
    amountCents: integer().notNull(),
    status: riderDebtStatus().notNull().default('open'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('idx_debt_rider').on(t.riderId)],
);

// ---------------------------------------------------------------------------
// Webhook idempotency ledger — Stripe event.id, inserted onConflictDoNothing.
// ---------------------------------------------------------------------------
export const webhookEvents = pgTable('webhook_events', {
  id: text().primaryKey(), // Stripe event.id (evt_xxx)
  type: text().notNull(),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
