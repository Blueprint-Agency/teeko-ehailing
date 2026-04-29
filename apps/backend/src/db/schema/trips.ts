import {
  bigserial,
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { vehicles } from './drivers';
import { geographyPoint } from './_types';

export const tripStatus = pgEnum('trip_status', [
  'requested',
  'matched',
  'driver_arrived',
  'in_trip',
  'completed',
  'cancelled',
  'no_show',
]);
export const tripEventType = pgEnum('trip_event_type', [
  'requested',
  'offered',
  'accepted',
  'declined',
  'arrived',
  'pickup',
  'in_trip',
  'completed',
  'cancelled',
  'no_show',
]);
export const tripOfferStatus = pgEnum('trip_offer_status', ['pending', 'terminal']);
export const tripOfferOutcome = pgEnum('trip_offer_outcome', [
  'accepted',
  'declined',
  'timeout',
  'outside_radius',
  'superseded',
]);
export const fareLineKind = pgEnum('fare_line_kind', [
  'base',
  'distance',
  'time',
  'surge',
  'toll',
  'airport',
  'tip',
]);
export const lostItemStatus = pgEnum('lost_item_status', ['open', 'resolved']);

export const fareQuotes = pgTable('fare_quotes', {
  id: uuid().primaryKey().defaultRandom(),
  riderId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text().notNull(),
  pickup: geographyPoint().notNull(),
  dropoff: geographyPoint().notNull(),
  pickupAddress: text(),
  dropoffAddress: text(),
  distanceMeters: integer().notNull(),
  durationSeconds: integer().notNull(),
  baseCents: integer().notNull(),
  surgeMultiplier: numeric({ precision: 4, scale: 2 }).notNull().default('1.00'),
  totalCents: integer().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const fareLines = pgTable('fare_lines', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  quoteId: uuid().references(() => fareQuotes.id, { onDelete: 'cascade' }),
  tripId: uuid(),
  kind: fareLineKind().notNull(),
  amountCents: integer().notNull(),
  commissionable: boolean().notNull().default(true),
});

export const trips = pgTable('trips', {
  id: uuid().primaryKey().defaultRandom(),
  riderId: uuid().notNull().references(() => users.id),
  driverId: uuid().references(() => users.id),
  vehicleId: uuid().references(() => vehicles.id),
  fareQuoteId: uuid().references(() => fareQuotes.id),
  status: tripStatus().notNull().default('requested'),
  category: text().notNull(),
  scheduledAt: timestamp({ withTimezone: true }),
  pickup: geographyPoint().notNull(),
  dropoff: geographyPoint().notNull(),
  pickupAddress: text(),
  dropoffAddress: text(),
  paymentMethodId: uuid(),
  finalFareCents: integer(),
  tipCents: integer().notNull().default(0),
  routePolyline: text(),
  driverArrivedAt: timestamp({ withTimezone: true }),
  pickedUpAt: timestamp({ withTimezone: true }),
  completedAt: timestamp({ withTimezone: true }),
  cancelledAt: timestamp({ withTimezone: true }),
  cancelReason: text(),
  noteToDriver: text(),
  shareToken: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const tripEvents = pgTable('trip_events', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  eventType: tripEventType().notNull(),
  actorId: uuid().references(() => users.id),
  payload: jsonb(),
  prevHash: text(),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const tripOffers = pgTable('trip_offers', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  driverId: uuid().notNull().references(() => users.id),
  status: tripOfferStatus().notNull().default('pending'),
  outcome: tripOfferOutcome(),
  offeredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  resolvedAt: timestamp({ withTimezone: true }),
  payload: jsonb(),
});

export const cancellations = pgTable('cancellations', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  actorId: uuid().notNull().references(() => users.id),
  audience: text().notNull(),
  reasonCode: text().notNull(),
  feeCents: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const noShowFees = pgTable('no_show_fees', {
  tripId: uuid().primaryKey().references(() => trips.id, { onDelete: 'cascade' }),
  driverArrivedAt: timestamp({ withTimezone: true }).notNull(),
  feeChargedAt: timestamp({ withTimezone: true }),
  amountCents: integer().notNull(),
  paymentId: uuid(),
});

export const pickupArrivalEvents = pgTable('pickup_arrival_events', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  driverId: uuid().notNull().references(() => users.id),
  location: geographyPoint().notNull(),
  geofencePass: boolean().notNull(),
  recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const tripPins = pgTable('trip_pins', {
  tripId: uuid().primaryKey().references(() => trips.id, { onDelete: 'cascade' }),
  pin: char({ length: 4 }).notNull(),
  issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp({ withTimezone: true }),
});

export const lostItemReports = pgTable('lost_item_reports', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  riderId: uuid().notNull().references(() => users.id),
  description: text().notNull(),
  status: lostItemStatus().notNull().default('open'),
  resolvedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
