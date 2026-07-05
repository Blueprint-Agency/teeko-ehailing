-- Payment system (teeko-payment-system.md) — Stripe Connect model.
-- Replaces the earlier payment scaffold (weekly payout bins + Teeko-held bank
-- accounts + the riders `payment_methods` table) with the ledger-first design:
-- tokenized methods, a charge ledger, driver earnings, Connect accounts,
-- payouts, rider debt, and a webhook dedup table. Money is integer sen.
--
-- NOTE: hand-authored (drizzle-kit generate is interactive re: enum drop/create).
-- After this lands, run `pnpm db:generate` once to re-baseline the meta snapshot.

-- ---- drop legacy payment objects (CASCADE clears dependent FKs) ------------
DROP TABLE IF EXISTS "early_cashout_requests" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "driver_bank_accounts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "driver_payouts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "refunds" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payments" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "payment_methods" CASCADE;
--> statement-breakpoint
DROP TYPE IF EXISTS "payment_provider";
--> statement-breakpoint
DROP TYPE IF EXISTS "cashout_status";
--> statement-breakpoint
DROP TYPE IF EXISTS "payment_method_kind";
--> statement-breakpoint
DROP TYPE IF EXISTS "payment_status";
--> statement-breakpoint

-- ---- enums -----------------------------------------------------------------
CREATE TYPE "payment_method_type" AS ENUM ('cash', 'card', 'tng', 'google_pay');
--> statement-breakpoint
CREATE TYPE "payment_kind" AS ENUM ('trip_fare', 'cancellation_fee', 'debt_settlement', 'tip');
--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'requires_action', 'failed', 'refunded', 'partially_refunded');
--> statement-breakpoint
CREATE TYPE "refund_reason" AS ENUM ('rider_complaint', 'driver_fault', 'overcharge', 'duplicate');
--> statement-breakpoint
CREATE TYPE "refund_status" AS ENUM ('pending', 'succeeded', 'failed');
--> statement-breakpoint
CREATE TYPE "connect_account_status" AS ENUM ('onboarding', 'active', 'restricted');
--> statement-breakpoint
CREATE TYPE "payout_method" AS ENUM ('standard', 'instant');
--> statement-breakpoint
CREATE TYPE "rider_debt_status" AS ENUM ('open', 'settled', 'written_off');
--> statement-breakpoint
-- payout_status ('pending','paid','failed') is retained from the prior schema.

-- ---- users gains a lazy Stripe customer id ---------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_customer_id_unique" UNIQUE ("stripe_customer_id");
--> statement-breakpoint

-- ---- payment_methods -------------------------------------------------------
CREATE TABLE "payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" "payment_method_type" NOT NULL,
  "external_id" text,
  "label" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "idx_pm_user" ON "payment_methods" ("user_id");
--> statement-breakpoint

-- ---- payments (charge ledger) ----------------------------------------------
CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" uuid,
  "rider_id" uuid NOT NULL,
  "driver_id" uuid,
  "payment_method_id" uuid,
  "kind" "payment_kind" NOT NULL,
  "method_type" "payment_method_type" NOT NULL,
  "amount_cents" integer NOT NULL,
  "commission_cents" integer DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'myr' NOT NULL,
  "status" "payment_status" DEFAULT 'pending' NOT NULL,
  "stripe_payment_intent_id" text,
  "receipt_url" text,
  "failure_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "trips"("id"),
  CONSTRAINT "payments_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "users"("id"),
  CONSTRAINT "payments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "users"("id"),
  CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_pi" ON "payments" ("stripe_payment_intent_id") WHERE "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_payments_rider" ON "payments" ("rider_id", "created_at");
--> statement-breakpoint
CREATE INDEX "idx_payments_trip" ON "payments" ("trip_id");
--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" ("status");
--> statement-breakpoint

-- ---- refunds ---------------------------------------------------------------
CREATE TABLE "refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_id" uuid NOT NULL,
  "stripe_refund_id" text,
  "amount_cents" integer NOT NULL,
  "reason" "refund_reason" NOT NULL,
  "reversed_transfer" boolean DEFAULT false NOT NULL,
  "status" "refund_status" DEFAULT 'pending' NOT NULL,
  "issued_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id"),
  CONSTRAINT "refunds_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refunds_stripe" ON "refunds" ("stripe_refund_id") WHERE "stripe_refund_id" IS NOT NULL;
--> statement-breakpoint

-- ---- driver_earnings -------------------------------------------------------
CREATE TABLE "driver_earnings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL,
  "trip_id" uuid NOT NULL,
  "payment_id" uuid,
  "gross_cents" integer NOT NULL,
  "commission_cents" integer NOT NULL,
  "net_cents" integer NOT NULL,
  "transferred" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "driver_earnings_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "users"("id"),
  CONSTRAINT "driver_earnings_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "trips"("id"),
  CONSTRAINT "driver_earnings_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_earning_trip" ON "driver_earnings" ("trip_id");
--> statement-breakpoint
CREATE INDEX "idx_earning_driver" ON "driver_earnings" ("driver_id", "created_at");
--> statement-breakpoint

-- ---- connect_accounts ------------------------------------------------------
CREATE TABLE "connect_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL,
  "stripe_account_id" text NOT NULL,
  "status" "connect_account_status" DEFAULT 'onboarding' NOT NULL,
  "payouts_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "connect_accounts_driver_id_unique" UNIQUE ("driver_id"),
  CONSTRAINT "connect_accounts_stripe_account_id_unique" UNIQUE ("stripe_account_id"),
  CONSTRAINT "connect_accounts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE cascade
);
--> statement-breakpoint

-- ---- payouts ---------------------------------------------------------------
CREATE TABLE "payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "driver_id" uuid NOT NULL,
  "stripe_payout_id" text,
  "amount_cents" integer NOT NULL,
  "method" "payout_method" DEFAULT 'standard' NOT NULL,
  "status" "payout_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payouts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payouts_stripe" ON "payouts" ("stripe_payout_id") WHERE "stripe_payout_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_payouts_driver" ON "payouts" ("driver_id", "created_at");
--> statement-breakpoint

-- re-point the incentive payout FKs (dropped by the driver_payouts CASCADE
-- above) to the new payouts table. Guarded so a partially-migrated dev DB that
-- is missing one of these tables still applies cleanly.
DO $$ BEGIN
  IF to_regclass('public.driver_bonuses') IS NOT NULL THEN
    ALTER TABLE "driver_bonuses" ADD CONSTRAINT "driver_bonuses_paid_payout_id_payouts_id_fk" FOREIGN KEY ("paid_payout_id") REFERENCES "payouts"("id");
  END IF;
  IF to_regclass('public.driver_incentive_progress') IS NOT NULL THEN
    ALTER TABLE "driver_incentive_progress" ADD CONSTRAINT "driver_incentive_progress_paid_payout_id_payouts_id_fk" FOREIGN KEY ("paid_payout_id") REFERENCES "payouts"("id");
  END IF;
END $$;
--> statement-breakpoint

-- ---- rider_debt ------------------------------------------------------------
CREATE TABLE "rider_debt" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rider_id" uuid NOT NULL,
  "payment_id" uuid,
  "amount_cents" integer NOT NULL,
  "status" "rider_debt_status" DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "settled_at" timestamp with time zone,
  CONSTRAINT "rider_debt_rider_id_users_id_fk" FOREIGN KEY ("rider_id") REFERENCES "users"("id"),
  CONSTRAINT "rider_debt_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
);
--> statement-breakpoint
CREATE INDEX "idx_debt_rider" ON "rider_debt" ("rider_id");
--> statement-breakpoint

-- ---- webhook_events (Stripe event dedup) -----------------------------------
CREATE TABLE "webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL
);
