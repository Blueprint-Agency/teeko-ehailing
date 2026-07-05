import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity';
import { geographyPoint } from './_types';

export const savedPlaceLabel = pgEnum('saved_place_label', ['home', 'work', 'custom']);

export const riderProfiles = pgTable('rider_profiles', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  defaultPaymentMethodId: uuid(),
  ratingAvg: numeric({ precision: 3, scale: 2 }),
  ratingCount: integer().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const savedPlaces = pgTable('saved_places', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: savedPlaceLabel().notNull(),
  address: text().notNull(),
  location: geographyPoint().notNull(),
});

export const recentPlaces = pgTable('recent_places', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text().notNull(),
  address: text().notNull(),
  location: geographyPoint().notNull(),
  lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// NOTE: rider payment methods now live in db/schema/payments.ts (`paymentMethods`),
// with the Stripe-tokenized design from the payment-system spec (type/externalId/
// label/soft-delete). The earlier scaffold table was removed to avoid a duplicate
// `payment_methods` definition.
