import {
  bigserial,
  date,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';

export const applicationState = pgEnum('application_state', [
  'phone_entered',
  'agreement_signed',
  'personal_docs_submitted',
  'vehicle_added',
  'vehicle_docs_submitted',
  'in_review',
  'rejected',
  'activated',
]);
export const documentOwnerKind = pgEnum('document_owner_kind', ['driver', 'vehicle']);
export const documentKind = pgEnum('document_kind', [
  'nric_front',
  'nric_back',
  'cdl',
  'psv_d',
  'driver_selfie',
  'car_grant',
  'road_tax',
  'puspakom',
  'insurance',
]);
export const documentReviewStatus = pgEnum('document_review_status', [
  'pending',
  'approved',
  'rejected',
]);
export const vehicleChangeStatus = pgEnum('vehicle_change_status', [
  'pending',
  'approved',
  'denied',
]);

export const driverApplications = pgTable('driver_applications', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  state: applicationState().notNull().default('phone_entered'),
  rejectionReason: text(),
  submittedAt: timestamp({ withTimezone: true }),
  approvedAt: timestamp({ withTimezone: true }),
  rejectedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const applicationSteps = pgTable('application_steps', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  applicationId: uuid().notNull().references(() => driverApplications.id, { onDelete: 'cascade' }),
  stepKey: text().notNull(),
  enteredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp({ withTimezone: true }),
  clientIp: text(),
  userAgent: text(),
});

export const documents = pgTable('documents', {
  id: uuid().primaryKey().defaultRandom(),
  ownerKind: documentOwnerKind().notNull(),
  ownerId: uuid().notNull(),
  kind: documentKind().notNull(),
  gcsPath: text().notNull(),
  mimeType: text(),
  sizeBytes: bigserial({ mode: 'number' }),
  ocrPayload: jsonb(),
  expiryDate: date(),
  uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const documentReviews = pgTable('document_reviews', {
  id: uuid().primaryKey().defaultRandom(),
  documentId: uuid().notNull().references(() => documents.id, { onDelete: 'cascade' }),
  status: documentReviewStatus().notNull().default('pending'),
  reviewerId: uuid().references(() => users.id),
  reason: text(),
  livenessScore: numeric({ precision: 4, scale: 3 }),
  reviewedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const vehicleChangeRequests = pgTable('vehicle_change_requests', {
  id: uuid().primaryKey().defaultRandom(),
  driverId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text().notNull(),
  status: vehicleChangeStatus().notNull().default('pending'),
  decidedBy: uuid().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
