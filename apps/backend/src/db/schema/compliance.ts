import {
  bigserial,
  boolean,
  date,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { vehicles } from './drivers';
import { trips } from './trips';

export const consentType = pgEnum('consent_type', [
  'tnc',
  'driver_agreement',
  'pdpa',
  'marketing',
]);
export const dsrKind = pgEnum('dsr_kind', ['access', 'erasure', 'correction']);
export const dsrStatus = pgEnum('dsr_status', ['received', 'processing', 'fulfilled', 'denied']);
export const evpAuthority = pgEnum('evp_authority', ['apad', 'lpkp']);
export const evpStatus = pgEnum('evp_status', ['pending', 'approved', 'expired', 'rejected']);
export const psvStatus = pgEnum('psv_status', ['valid', 'expired', 'revoked']);

export const consentLog = pgTable('consent_log', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentVersionId: uuid().notNull(),
  consentType: consentType().notNull(),
  scrolledToBottom: boolean().notNull().default(false),
  clientIp: text(),
  userAgent: text(),
  givenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  actorId: uuid().notNull().references(() => users.id),
  action: text().notNull(),
  targetType: text().notNull(),
  targetId: text().notNull(),
  payload: jsonb(),
  prevHash: text(),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const dataSubjectRequests = pgTable('data_subject_requests', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: dsrKind().notNull(),
  status: dsrStatus().notNull().default('received'),
  exportGcsPath: text(),
  fulfilledAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const evpRecords = pgTable('evp_records', {
  id: uuid().primaryKey().defaultRandom(),
  vehicleId: uuid().notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  driverId: uuid().notNull().references(() => users.id),
  authority: evpAuthority().notNull(),
  region: text().notNull(),
  applicationNo: text(),
  status: evpStatus().notNull().default('pending'),
  expiryDate: date(),
  submittedAt: timestamp({ withTimezone: true }),
  approvedAt: timestamp({ withTimezone: true }),
});

export const psvRecords = pgTable('psv_records', {
  driverId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  licenceNo: text().notNull().unique(),
  expiryDate: date().notNull(),
  status: psvStatus().notNull().default('valid'),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const insuranceCertificates = pgTable('insurance_certificates', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  certNumber: text().notNull().unique(),
  insurer: text().notNull(),
  gcsPath: text().notNull(),
  coverageCents: text(),
  issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
