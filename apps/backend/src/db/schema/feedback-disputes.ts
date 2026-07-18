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

// Who raised the feedback / dispute.
export const disputeRaiserRole = pgEnum('dispute_raiser_role', ['rider', 'driver']);

export const feedbackCategory = pgEnum('feedback_category', [
  'app',
  'driver',
  'ride',
  'payment',
  'suggestion',
  'other',
]);

export const disputeCategory = pgEnum('dispute_category', [
  'overcharge',
  'driver_behaviour',
  'route_issue',
  'payment_error',
  'cleanliness',
  'other',
]);

// Dispute lifecycle. The three admin queues are derived from this:
//   Dispute Queue      → open, escalated
//   Refund Queue       → refund_pending, refund_processing, refund_failed
//   Dispute Completion → refund_completed, rejected
export const disputeStatus = pgEnum('dispute_status', [
  'open',
  'escalated',
  'refund_pending',
  'refund_processing',
  'refund_completed',
  'refund_failed',
  'rejected',
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

// Formal disputes raised against a trip. Once a refund is approved the row
// stays here but moves through the refund_* statuses (managed in the Refund
// Queue) until it lands in a terminal state shown in Dispute Completion.
export const disputes = pgTable('disputes', {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid().references(() => trips.id, { onDelete: 'set null' }),
  raisedById: uuid().references(() => users.id, { onDelete: 'set null' }),
  raisedByRole: disputeRaiserRole().notNull().default('rider'),
  category: disputeCategory().notNull().default('other'),
  status: disputeStatus().notNull().default('open'),
  amountCents: integer().notNull().default(0),
  description: text().notNull(),
  // Free-text note captured when the dispute is resolved (reject / approve / escalate).
  resolutionNote: text(),
  // Notes + external reference captured while managing the refund payout.
  refundNote: text(),
  refundRef: text(),
  handledBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
