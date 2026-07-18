-- Feedback + dispute refund workflow.
--
-- Staging's 0010_lumpy_stardust already created the `disputes` table and the
-- dispute_category / dispute_status enums (rider-raised disputes). During the
-- feedback/dispute merge we kept that table as the source of truth, so this
-- migration only:
--   • extends dispute_status with the admin refund-workflow statuses,
--   • adds the refund payout columns to `disputes`,
--   • adds the independent `feedback` table (+ its enums).
ALTER TYPE "public"."dispute_status" ADD VALUE IF NOT EXISTS 'escalated';--> statement-breakpoint
ALTER TYPE "public"."dispute_status" ADD VALUE IF NOT EXISTS 'refund_pending';--> statement-breakpoint
ALTER TYPE "public"."dispute_status" ADD VALUE IF NOT EXISTS 'refund_processing';--> statement-breakpoint
ALTER TYPE "public"."dispute_status" ADD VALUE IF NOT EXISTS 'refund_completed';--> statement-breakpoint
ALTER TYPE "public"."dispute_status" ADD VALUE IF NOT EXISTS 'refund_failed';--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "refund_note" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "refund_ref" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "handled_by" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TYPE "public"."dispute_raiser_role" AS ENUM('rider', 'driver');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('app', 'driver', 'ride', 'payment', 'suggestion', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"trip_id" uuid,
	"role" "dispute_raiser_role" DEFAULT 'rider' NOT NULL,
	"category" "feedback_category" DEFAULT 'other' NOT NULL,
	"rating" integer,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
