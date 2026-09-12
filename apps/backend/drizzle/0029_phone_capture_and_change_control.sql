-- Phone capture & change control.
--
-- Three things at once, because they are one feature:
--   1. `users.phone` stops being an identity key — the UNIQUE index is dropped
--      so one person may hold a rider account and a driver account on the same
--      number, exactly as they already may on the same email.
--   2. Two new columns: `phone_country` (ISO-3166 alpha-2, so the picker can
--      round-trip an ambiguous dial code) and `phone_changed_at` (the one
--      30-day cooldown clock for both roles and both change paths).
--   3. The driver-only review queue becomes role-agnostic: renamed to
--      `profile_change_requests`, `driver_id` → `user_id`, plus `is_early`,
--      `reason` and `requested_country` for the rider early-change request.
--
-- Renamed rather than recreated: the queue holds pending requests that drivers
-- are waiting on, and a DROP/CREATE would silently discard them.
--
-- Every statement is guarded so a re-run on a partially migrated DB is a no-op,
-- matching 0024-0028.

-- 1 ── users.phone is contact data, not an identity key ──────────────────────
-- Drizzle may have emitted this as either a bare index or a table constraint
-- depending on version, so clear both spellings.
--
-- The constraint goes FIRST and the index second, and the order is load-bearing:
-- when the uniqueness is a constraint, Postgres owns the backing index and
-- `DROP INDEX` on it raises 2BP01 ("...because constraint ... requires it")
-- rather than skipping, so `IF EXISTS` does not save you. Dropping the
-- constraint takes its index with it, leaving the second statement a genuine
-- no-op; on a DB where it really is a bare index, the first is the no-op.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "users_phone_unique";--> statement-breakpoint

-- 2 ── the picker's round-trip column and the cooldown clock ─────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_country" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_changed_at" timestamp with time zone;--> statement-breakpoint

-- OTP codes are now matched on purpose, not just on user. Without this every
-- phone-change verification scans the user's whole code history.
CREATE INDEX IF NOT EXISTS "otp_codes_user_purpose_idx" ON "otp_codes" ("user_id","purpose");--> statement-breakpoint

-- 3 ── generalise the driver-only queue to both roles ────────────────────────
DO $$ BEGIN
 ALTER TABLE "driver_profile_change_requests" RENAME TO "profile_change_requests";
EXCEPTION
 WHEN undefined_table THEN null;  -- already renamed
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "profile_change_requests" RENAME COLUMN "driver_id" TO "user_id";
EXCEPTION
 WHEN undefined_column THEN null;  -- already renamed
END $$;--> statement-breakpoint

ALTER TABLE "profile_change_requests" ADD COLUMN IF NOT EXISTS "requested_country" text;--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD COLUMN IF NOT EXISTS "is_early" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD COLUMN IF NOT EXISTS "reason" text;--> statement-breakpoint

-- Indexes and constraints carry the old name until told otherwise. The partial
-- unique index on (user_id, field) WHERE status = 'pending' is preserved
-- verbatim by the rename — it is what enforces "at most one open request".
DO $$ BEGIN
 ALTER INDEX "driver_profile_change_requests_driver_idx" RENAME TO "profile_change_requests_user_idx";
EXCEPTION
 WHEN undefined_table OR undefined_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER INDEX "driver_profile_change_requests_status_idx" RENAME TO "profile_change_requests_status_idx";
EXCEPTION
 WHEN undefined_table OR undefined_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER INDEX "driver_profile_change_requests_open_idx" RENAME TO "profile_change_requests_open_idx";
EXCEPTION
 WHEN undefined_table OR undefined_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "profile_change_requests" RENAME CONSTRAINT "driver_profile_change_requests_driver_id_users_id_fk" TO "profile_change_requests_user_id_users_id_fk";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "profile_change_requests" RENAME CONSTRAINT "driver_profile_change_requests_reviewed_by_users_id_fk" TO "profile_change_requests_reviewed_by_users_id_fk";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER INDEX "driver_profile_change_requests_pkey" RENAME TO "profile_change_requests_pkey";
EXCEPTION
 WHEN undefined_table OR undefined_object THEN null;
END $$;--> statement-breakpoint

-- 4 ── backfill ─────────────────────────────────────────────────────────────
-- Existing '+60…' numbers are Malaysian by construction (the old
-- `normalizePhone` rewrote a bare leading 0 to +60), so the picker can be told
-- so outright. Everything else stays NULL and the UI falls back to a
-- best-effort dial-code match.
UPDATE "users" SET "phone_country" = 'MY'
 WHERE "phone" LIKE '+60%' AND "phone_country" IS NULL;--> statement-breakpoint

-- Seed the new cooldown clock from the old one. Without this, every driver who
-- had a phone change approved in the last 30 days would get a second change
-- for free the moment this ships — the old clock lived on the request row, and
-- nothing would be carrying it forward.
UPDATE "users" u
   SET "phone_changed_at" = r."applied_at"
  FROM (
        SELECT "user_id", max("applied_at") AS "applied_at"
          FROM "profile_change_requests"
         WHERE "field" = 'phone'
           AND "status" = 'approved'
           AND "applied_at" IS NOT NULL
         GROUP BY "user_id"
       ) r
 WHERE u."id" = r."user_id"
   AND u."phone_changed_at" IS NULL;
