-- Trip ratings — rider rates the driver after a completed trip.
-- Adds three nullable columns to `trips`; no backfill needed (existing trips
-- simply remain unrated). Mirrors the shared `Trip.rating` / `Trip.comment`.
--
-- NOTE: hand-authored to stay consistent with 0007 (drizzle-kit generate is
-- interactive re: the payment enum churn). After this lands, run
-- `pnpm db:generate` once to re-baseline the meta snapshot.

ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "rider_rating" integer;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "rider_comment" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "rated_at" timestamp with time zone;
