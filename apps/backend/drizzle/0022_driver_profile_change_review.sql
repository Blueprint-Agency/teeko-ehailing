CREATE TYPE "public"."profile_change_field" AS ENUM('full_name', 'phone');--> statement-breakpoint
CREATE TYPE "public"."profile_change_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_profile_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"field" "profile_change_field" NOT NULL,
	"current_value" text,
	"requested_value" text NOT NULL,
	"status" "profile_change_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_profile_change_requests" ADD CONSTRAINT "driver_profile_change_requests_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_profile_change_requests" ADD CONSTRAINT "driver_profile_change_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_profile_change_requests_driver_idx" ON "driver_profile_change_requests" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_profile_change_requests_status_idx" ON "driver_profile_change_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "driver_profile_change_requests_open_idx" ON "driver_profile_change_requests" USING btree ("driver_id","field") WHERE status = 'pending';