-- Link each driver earning to the payout that covered it.
--
-- The driver earnings screen shows "pending payout" — what Teeko still owes.
-- `transferred` cannot answer that: it records the Stripe Connect transfer made
-- at charge time, so a card trip is flagged true the moment the rider is
-- charged, long before any money reaches the driver's own bank account.
--
-- `payout_id` is null while the driver is still owed the earning, and set when
-- the admin payout export creates the payout that pays it out.
--
-- Statements are guarded so a re-run on a partially migrated DB is a no-op.
ALTER TABLE "driver_earnings" ADD COLUMN IF NOT EXISTS "payout_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "driver_earnings" ADD CONSTRAINT "driver_earnings_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_earning_unpaid" ON "driver_earnings" USING btree ("driver_id","payout_id");
