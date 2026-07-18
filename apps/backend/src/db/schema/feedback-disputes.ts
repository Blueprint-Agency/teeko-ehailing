import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { trips } from './trips';

// NOTE: the `disputes` table + dispute_category / dispute_status enums live in
// ./trips.ts (the rider-raised disputes model). This file only owns the general
// `feedback` table, which is independent of disputes.

// Who raised the feedback.
export const disputeRaiserRole = pgEnum('dispute_raiser_role', ['rider', 'driver']);

export const feedbackCategory = pgEnum('feedback_category', [
  'app',
  'driver',
  'ride',
  'payment',
  'suggestion',
  'other',
]);

// General feedback from riders / drivers — not a formal dispute.
export const feedback = pgTable('feedback', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: 'set null' }),
  tripId: uuid().references(() => trips.id, { onDelete: 'set null' }),
  role: disputeRaiserRole().notNull().default('rider'),
  category: feedbackCategory().notNull().default('other'),
  rating: integer(),
  message: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
