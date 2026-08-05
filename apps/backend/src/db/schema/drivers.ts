import {
  boolean,
  date,
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
