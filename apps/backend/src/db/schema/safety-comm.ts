import {
  bigserial,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { trips } from './trips';
import { geographyPoint } from './_types';

export const incidentStatus = pgEnum('incident_status', ['open', 'reviewing', 'resolved']);
export const strikeKind = pgEnum('strike_kind', [
  'no_show',
  'late',
  'rude',
  'safety',
  'cancellation',
]);
export const strikeSeverity = pgEnum('strike_severity', ['low', 'medium', 'high']);
export const supportTicketKind = pgEnum('support_ticket_kind', [
  'appeal',
  'deactivation',
  'evp_change',
  'vehicle_change',
  'other',
]);
// Rider/driver general help-desk categories (mirrors the admin Support page).
export const supportTicketCategory = pgEnum('support_ticket_category', [
  'technical',
  'complaint',
  'payment',
  'billing',
  'account',
  'documents',
  'safety',
  'other',
]);
export const supportPriority = pgEnum('support_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);
// in_review/denied are the driver-appeal lifecycle; in_progress/escalated were
// added for the general help-desk flow (matches the admin StatusChip vocab).
export const supportTicketStatus = pgEnum('support_ticket_status', [
  'open',
  'in_review',
  'resolved',
  'denied',
  'in_progress',
  'escalated',
]);

export const emergencyContacts = pgTable('emergency_contacts', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  phone: text().notNull(),
  relation: text(),
});

export const sosEvents = pgTable('sos_events', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().references(() => trips.id),
  userId: uuid().notNull().references(() => users.id),
  location: geographyPoint().notNull(),
  notifiedContacts: jsonb(),
  resolvedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const tripShareTokens = pgTable('trip_share_tokens', {
  token: text().primaryKey(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const incidentReports = pgTable('incident_reports', {
  id: uuid().primaryKey().defaultRandom(),
  reporterId: uuid().notNull().references(() => users.id),
  targetId: uuid().references(() => users.id),
  tripId: uuid().references(() => trips.id),
  reason: text().notNull(),
  evidence: jsonb(),
  status: incidentStatus().notNull().default('open'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const userStrikes = pgTable('user_strikes', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: strikeKind().notNull(),
  severity: strikeSeverity().notNull(),
  decaysAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const tripMessages = pgTable('trip_messages', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  senderId: uuid().notNull().references(() => users.id),
  body: text().notNull(),
  sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const voiceProxySessions = pgTable('voice_proxy_sessions', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().notNull().references(() => trips.id, { onDelete: 'cascade' }),
  callerId: uuid().notNull().references(() => users.id),
  proxyNumber: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const supportTickets = pgTable('support_tickets', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  // `kind` is only meaningful for driver account-action tickets (appeal, etc.);
  // general help tickets are classified by `category` instead, so it's nullable.
  kind: supportTicketKind(),
  category: supportTicketCategory().notNull().default('other'),
  subject: text().notNull(),
  // Rider never sets priority — defaults to medium, an admin triages from there.
  priority: supportPriority().notNull().default('medium'),
  refId: uuid(),
  body: text().notNull(),
  attachments: jsonb(),
  status: supportTicketStatus().notNull().default('open'),
  handledBy: uuid().references(() => users.id),
  resolvedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
