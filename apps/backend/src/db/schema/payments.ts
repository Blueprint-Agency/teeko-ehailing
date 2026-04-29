import {
  customType,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { trips } from './trips';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const paymentProvider = pgEnum('payment_provider', ['stripe', 'tng', 'grabpay', 'gpay']);
export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'authorizing',
  'captured',
  'failed',
  'refunded',
]);
export const payoutStatus = pgEnum('payout_status', ['pending', 'paid', 'failed']);
export const cashoutStatus = pgEnum('cashout_status', ['pending', 'paid', 'denied']);

export const payments = pgTable('payments', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().references(() => trips.id),
  userId: uuid().notNull().references(() => users.id),
  paymentMethodId: uuid(),
  provider: paymentProvider().notNull(),
  providerIntentId: text(),
  amountCents: integer().notNull(),
  status: paymentStatus().notNull().default('pending'),
  redirectUrl: text(),
  capturedAt: timestamp({ withTimezone: true }),
  failureCode: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable('refunds', {
  id: uuid().primaryKey().defaultRandom(),
  paymentId: uuid().notNull().references(() => payments.id),
  amountCents: integer().notNull(),
  reason: text(),
  issuedBy: uuid().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const driverBankAccounts = pgTable('driver_bank_accounts', {
  driverId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  bankCode: text().notNull(),
  maskedAccountNo: text().notNull(),
  accountHolderName: text().notNull(),
  encryptedBlob: bytea().notNull(),
  verifiedAt: timestamp({ withTimezone: true }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const driverPayouts = pgTable('driver_payouts', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid().notNull().references(() => users.id),
  yearIso: integer().notNull(),
  weekIso: integer().notNull(),
  periodStart: date().notNull(),
  periodEnd: date().notNull(),
  grossCents: integer().notNull(),
  commissionCents: integer().notNull(),
  netCents: integer().notNull(),
  status: payoutStatus().notNull().default('pending'),
  paidAt: timestamp({ withTimezone: true }),
  failureReason: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const earlyCashoutRequests = pgTable('early_cashout_requests', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid().notNull().references(() => users.id),
  amountCents: integer().notNull(),
  status: cashoutStatus().notNull().default('pending'),
  decidedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
