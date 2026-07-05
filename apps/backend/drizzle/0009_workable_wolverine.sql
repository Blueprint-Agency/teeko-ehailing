CREATE TYPE "public"."connect_account_status" AS ENUM('onboarding', 'active', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('trip_fare', 'cancellation_fee', 'debt_settlement', 'tip');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('cash', 'card', 'tng', 'google_pay');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('standard', 'instant');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('rider_complaint', 'driver_fault', 'overcharge', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."rider_debt_status" AS ENUM('open', 'settled', 'written_off');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connect_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"stripe_account_id" text NOT NULL,
	"status" "connect_account_status" DEFAULT 'onboarding' NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connect_accounts_driverId_unique" UNIQUE("driver_id"),
	CONSTRAINT "connect_accounts_stripeAccountId_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"payment_id" uuid,
	"gross_cents" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"transferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"stripe_payout_id" text,
	"amount_cents" integer NOT NULL,
	"method" "payout_method" DEFAULT 'standard' NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rider_debt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rider_id" uuid NOT NULL,
	"payment_id" uuid,
	"amount_cents" integer NOT NULL,
	"status" "rider_debt_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_bank_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "driver_payouts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "early_cashout_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "driver_bank_accounts" CASCADE;--> statement-breakpoint
DROP TABLE "driver_payouts" CASCADE;--> statement-breakpoint
DROP TABLE "early_cashout_requests" CASCADE;--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "driver_incentive_progress" DROP CONSTRAINT "driver_incentive_progress_paid_payout_id_driver_payouts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "is_default" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "payment_methods" ALTER COLUMN "is_default" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "reason" SET DATA TYPE refund_reason;--> statement-breakpoint
ALTER TABLE "refunds" ALTER COLUMN "reason" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "type" "payment_method_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "rider_rating" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "rider_comment" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "rated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "rider_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "driver_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "kind" "payment_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "method_type" "payment_method_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "commission_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" text DEFAULT 'myr' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "stripe_refund_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "reversed_transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "status" "refund_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connect_accounts" ADD CONSTRAINT "connect_accounts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payouts" ADD CONSTRAINT "payouts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_debt" ADD CONSTRAINT "rider_debt_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_debt" ADD CONSTRAINT "rider_debt_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_earning_trip" ON "driver_earnings" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_earning_driver" ON "driver_earnings" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payouts_stripe" ON "payouts" USING btree ("stripe_payout_id") WHERE "payouts"."stripe_payout_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payouts_driver" ON "payouts" USING btree ("driver_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_debt_rider" ON "rider_debt" USING btree ("rider_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_incentive_progress" ADD CONSTRAINT "driver_incentive_progress_paid_payout_id_payouts_id_fk" FOREIGN KEY ("paid_payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pm_user" ON "payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_pi" ON "payments" USING btree ("stripe_payment_intent_id") WHERE "payments"."stripe_payment_intent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_rider" ON "payments" USING btree ("rider_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_trip" ON "payments" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_refunds_stripe" ON "refunds" USING btree ("stripe_refund_id") WHERE "refunds"."stripe_refund_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "kind";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "brand";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "last4";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "provider_customer_id";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "provider_method_id";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "exp_month";--> statement-breakpoint
ALTER TABLE "payment_methods" DROP COLUMN IF EXISTS "exp_year";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "provider";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "provider_intent_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "redirect_url";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "captured_at";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripeCustomerId_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "public"."payments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'requires_action', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
ALTER TABLE "public"."payments" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status" USING "status"::"public"."payment_status";--> statement-breakpoint
DROP TYPE "public"."payment_method_kind";--> statement-breakpoint
DROP TYPE "public"."cashout_status";--> statement-breakpoint
DROP TYPE "public"."payment_provider";