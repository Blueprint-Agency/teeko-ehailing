-- Driver bank accounts.
--
-- Driver payout setup collects bank details in the app (finance pays drivers
-- from the admin payout sheet), so we store exactly what that sheet prints:
-- bank, account holder name, account number. One account per driver.
--
-- Statements are guarded so a re-run on a partially migrated DB is a no-op.
CREATE TABLE IF NOT EXISTS "driver_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"account_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_bank_accounts_driver_id_unique" UNIQUE("driver_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_bank_accounts" ADD CONSTRAINT "driver_bank_accounts_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
