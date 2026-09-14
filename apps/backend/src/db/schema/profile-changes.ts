import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './identity';

// Review queue for name and phone edits, for **both** roles.
//
// Moved here from `drivers.ts` (and renamed off `driver_profile_change_requests`)
// when riders gained the early-phone-change request: a rider inside the 30-day
// cooldown raises a row here too, so the table is no longer driver-shaped.
//
// A driver's name and phone are identity evidence for APAD/JPJ, so a driver
// edit is always a *request*, never a write: the row lands as `pending`, an
// admin approves or rejects it, and only an approval copies the value onto
// `users`.
//
// Two different clocks measure the two fields, deliberately:
//   • `full_name` — `appliedAt` on the last approved request for that field,
//     30 days, unchanged from the driver-only behaviour.
//   • `phone` — `users.phone_changed_at`, one clock covering self-service and
//     admin-approved writes alike, so a rider cannot get two changes by
//     alternating between the two paths.
// Either way a rejected request costs the user nothing.
export const profileChangeField = pgEnum('profile_change_field', ['full_name', 'phone']);
export const profileChangeStatus = pgEnum('profile_change_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const profileChangeRequests = pgTable(
  'profile_change_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    field: profileChangeField().notNull(),
    // Snapshot of what the field held when the request was raised, so the
    // reviewer sees the before/after even if something else moved since.
    currentValue: text(),
    requestedValue: text().notNull(),
    // ISO-3166 alpha-2 for a phone request, so approval can write
    // `users.phone_country` alongside the number and the picker round-trips.
    requestedCountry: text(),
    status: profileChangeStatus().notNull().default('pending'),
    // Raised inside the 30-day window. Not a rejection — the reviewer simply
    // sees a ⚠️ badge, the last-changed date, and the user's reason.
    isEarly: boolean().notNull().default(false),
    // Required on an early request, absent otherwise. The user's own words.
    reason: text(),
    reviewedBy: uuid().references(() => users.id),
    reviewedAt: timestamp({ withTimezone: true }),
    // Admin's reason — required on reject, shown to the user in-app.
    reviewNote: text(),
    // Set only when the value actually reached `users`. This, not reviewedAt,
    // is what the `full_name` cooldown measures from.
    appliedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('profile_change_requests_user_idx').on(t.userId),
    index('profile_change_requests_status_idx').on(t.status),
    // At most one open request per field — the user edits the pending value by
    // cancelling and re-submitting, never by stacking requests.
    uniqueIndex('profile_change_requests_open_idx')
      .on(t.userId, t.field)
      .where(sql`status = 'pending'`),
  ],
);
