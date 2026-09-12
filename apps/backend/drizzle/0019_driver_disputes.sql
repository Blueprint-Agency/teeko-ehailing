-- Driver-raised disputes.
--
-- The driver app's Report Issue screen now files a real dispute instead of a
-- mock support form, so `disputes` has to hold rows raised by either side:
--   • raised_by  — which side filed it (existing rows default to 'rider'),
--   • driver_id  — the filing driver (rider_id stays null on those rows),
--   • rider_id / trip_id become nullable (a document or account issue has no
--     trip, and a driver-raised row has no rider),
--   • two driver-only categories: 'document', 'account'.
--
-- Statements are guarded so a re-run on a partially migrated DB is a no-op.
ALTER TYPE "public"."dispute_category" ADD VALUE IF NOT EXISTS 'document';--> statement-breakpoint
ALTER TYPE "public"."dispute_category" ADD VALUE IF NOT EXISTS 'account';--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "trip_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ALTER COLUMN "rider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "driver_id" uuid;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "raised_by" "dispute_raiser_role" DEFAULT 'rider' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disputes_driver_idx" ON "disputes" USING btree ("driver_id");
