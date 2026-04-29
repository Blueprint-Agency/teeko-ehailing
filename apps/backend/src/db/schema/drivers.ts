import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const vehicles = pgTable('vehicles', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  plateNumber: text().notNull().unique(),
  make: text().notNull(),
  model: text().notNull(),
  year: integer().notNull(),
  colour: text(),
  category: rideCategory().notNull(),
  isActive: boolean().notNull().default(false),
  puspakomExpiry: date(),
  roadTaxExpiry: date(),
  insuranceExpiry: date(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const driverActiveVehicle = pgTable('driver_active_vehicle', {
  driverId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
});

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
