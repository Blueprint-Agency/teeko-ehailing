CREATE TYPE "public"."dispute_category" AS ENUM('overcharge', 'driver_behaviour', 'route_issue', 'payment_error', 'cleanliness', 'other');--> statement-breakpoint
CREATE TYPE "public"."dispute_raiser_role" AS ENUM('rider', 'driver');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'escalated', 'refund_pending', 'refund_processing', 'refund_completed', 'refund_failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."feedback_category" AS ENUM('app', 'driver', 'ride', 'payment', 'suggestion', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid,
	"raised_by_id" uuid,
	"raised_by_role" "dispute_raiser_role" DEFAULT 'rider' NOT NULL,
	"category" "dispute_category" DEFAULT 'other' NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"resolution_note" text,
	"refund_note" text,
	"refund_ref" text,
	"handled_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_id_users_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "disputes" ADD CONSTRAINT "disputes_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
