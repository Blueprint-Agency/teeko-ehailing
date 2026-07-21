-- ─── Split surge into computed vs admin-set ──────────────────────────────────
-- The surge-recompute worker and the admin Surge Control panel both need to set
-- a zone's multiplier. Sharing one column meant a recompute pass silently
-- overwrote whatever an admin had just dialled in, with no record a human had
-- intervened. Split them:
--
--   manual_multiplier + manual_until  ← admin writes (a time-boxed override)
--   auto_multiplier                   ← worker writes
--
-- Resolution at quote time: an unexpired manual override wins, else the
-- computed value, else the global surge_config row, else 1.0.

-- The existing column was admin-written, so it becomes the manual one.
ALTER TABLE "surge_zones" RENAME COLUMN "multiplier" TO "manual_multiplier";
--> statement-breakpoint

-- A zone need not carry a manual override; NULL now means "no override set".
ALTER TABLE "surge_zones" ALTER COLUMN "manual_multiplier" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "surge_zones" ADD COLUMN IF NOT EXISTS "auto_multiplier" numeric(4,2);
--> statement-breakpoint

ALTER TABLE "surge_zones" ADD COLUMN IF NOT EXISTS "manual_until" timestamp with time zone;
--> statement-breakpoint

-- Backfill: every pre-existing multiplier was set by an admin and is currently
-- in force. Without a manual_until these would all read as expired overrides on
-- deploy and silently drop to 1.0x, so honour them for the rest of the zone's
-- own active window.
UPDATE "surge_zones"
SET "manual_until" = "active_until"
WHERE "manual_multiplier" IS NOT NULL AND "manual_until" IS NULL;
--> statement-breakpoint

-- Zones sitting at a no-op 1.00 carry no real override — clear them so the
-- worker can manage those zones from the start.
UPDATE "surge_zones"
SET "manual_multiplier" = NULL, "manual_until" = NULL
WHERE "manual_multiplier" = 1.00;
