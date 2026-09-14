-- Driver → rider ratings. Mirrors the rider → driver columns added in 0008 so
-- each trip carries at most one rating per direction. Aggregates on
-- driver_profiles / rider_profiles (rating_avg, rating_count) are recomputed
-- from these columns by the trips service on every write.

ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_rating" integer;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_comment" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "driver_rated_at" timestamp with time zone;
