import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { geographyPoint } from './_types';

export const driverApprovalStatus = pgEnum('driver_approval_status', [
  'pending',
  'approved',
  'suspended',
  'deactivated',
]);
export const driverAvailability = pgEnum('driver_availability', ['offline', 'online', 'on_trip']);
export const rideCategory = pgEnum('ride_category', ['go', 'comfort', 'xl', 'premium', 'bike']);

export const driverProfiles = pgTable('driver_profiles', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  approvalStatus: driverApprovalStatus().notNull().default('pending'),
  availability: driverAvailability().notNull().default('offline'),
  ratingAvg: numeric({ precision: 3, scale: 2 }),
  ratingCount: integer().default(0),
  acceptanceRate: numeric({ precision: 5, scale: 2 }),
  cancellationRate: numeric({ precision: 5, scale: 2 }),
  completionRate: numeric({ precision: 5, scale: 2 }),
  totalTrips: integer().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// One vehicle per driver: the driver's account *is* the vehicle's registration.
// The unique index on driverId is what enforces it — there is no active/inactive
// flag and no active-vehicle mapping table, because there is nothing to choose
// between. A driver changing car updates this row (and re-submits its documents).
export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid().primaryKey().defaultRandom(),
    driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    plateNumber: text().notNull().unique(),
    make: text().notNull(),
    model: text().notNull(),
    year: integer().notNull(),
    colour: text(),
    category: rideCategory().notNull(),
    puspakomExpiry: date(),
    roadTaxExpiry: date(),
    insuranceExpiry: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_vehicle_driver').on(t.driverId)],
);

export const driverLocations = pgTable('driver_locations', {
  driverId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  location: geographyPoint().notNull(),
  heading: numeric({ precision: 5, scale: 2 }),
  speed: numeric({ precision: 6, scale: 2 }),
  recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const driverRadiusSettings = pgTable('driver_radius_settings', {
  driverId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  maxRadiusKm: numeric({ precision: 4, scale: 1 }).notNull().default('5'),
  categories: text().array().notNull().default(['go']),
});

// ── Driver profile change review ────────────────────────────────────────────
// A driver's name and phone are identity evidence for APAD/JPJ, so an edit is a
// *request*, not a write: the row lands here as `pending`, an admin approves or
// rejects it, and only an approval copies the value onto `users`. One field may
// change once every 30 days, counted from the last approval of THAT field —
// `appliedAt` is the clock, so a rejected request costs the driver nothing.
export const profileChangeField = pgEnum('profile_change_field', ['full_name', 'phone']);
export const profileChangeStatus = pgEnum('profile_change_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const driverProfileChangeRequests = pgTable(
  'driver_profile_change_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    field: profileChangeField().notNull(),
    // Snapshot of what the field held when the request was raised, so the
    // reviewer sees the before/after even if something else moved since.
    currentValue: text(),
    requestedValue: text().notNull(),
    status: profileChangeStatus().notNull().default('pending'),
    reviewedBy: uuid().references(() => users.id),
    reviewedAt: timestamp({ withTimezone: true }),
    // Admin's reason — required on reject, shown to the driver in-app.
    reviewNote: text(),
    // Set only when the value actually reached `users`. This, not reviewedAt,
    // is what the 30-day cooldown measures from.
    appliedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('driver_profile_change_requests_driver_idx').on(t.driverId),
    index('driver_profile_change_requests_status_idx').on(t.status),
    // At most one open request per field — the driver edits the pending value
    // by cancelling and re-submitting, never by stacking requests.
    uniqueIndex('driver_profile_change_requests_open_idx')
      .on(t.driverId, t.field)
      .where(sql`status = 'pending'`),
  ],
);
