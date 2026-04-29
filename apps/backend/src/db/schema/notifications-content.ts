import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';

export const notificationChannel = pgEnum('notification_channel', ['push', 'sms', 'email']);
export const notificationStatus = pgEnum('notification_status', [
  'queued',
  'sent',
  'failed',
  'dropped',
]);
export const devicePlatform = pgEnum('device_platform', ['ios', 'android', 'web']);
export const notificationCategory = pgEnum('notification_category', [
  'trip',
  'evp',
  'doc_expiry',
  'payout',
  'suspension',
  'incentive',
  'broadcast',
]);

export const notificationOutbox = pgTable('notification_outbox', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  channel: notificationChannel().notNull(),
  templateKey: text().notNull(),
  locale: text().notNull(),
  payload: jsonb().notNull(),
  status: notificationStatus().notNull().default('queued'),
  attemptCount: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const notificationInbox = pgTable('notification_inbox', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: notificationCategory().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  deeplink: text(),
  refId: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp({ withTimezone: true }),
});

export const deviceTokens = pgTable('device_tokens', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: devicePlatform().notNull(),
  token: text().notNull().unique(),
  registeredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const broadcastMessages = pgTable('broadcast_messages', {
  id: uuid().primaryKey().defaultRandom(),
  composedBy: uuid().notNull().references(() => users.id),
  templateKey: text().notNull(),
  segmentFilter: jsonb().notNull(),
  scheduledAt: timestamp({ withTimezone: true }),
  sentAt: timestamp({ withTimezone: true }),
  payload: jsonb(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const broadcastRecipients = pgTable(
  'broadcast_recipients',
  {
    broadcastId: uuid().notNull().references(() => broadcastMessages.id, { onDelete: 'cascade' }),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    deliveredAt: timestamp({ withTimezone: true }),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.broadcastId, t.userId] })],
);

export const contentVersions = pgTable('content_versions', {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull(),
  locale: text().notNull(),
  version: integer().notNull(),
  body: text().notNull(),
  publishedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const cancellationReasons = pgTable(
  'cancellation_reasons',
  {
    code: text().notNull(),
    audience: text().notNull(),
    locale: text().notNull(),
    label: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.code, t.audience, t.locale] })],
);
