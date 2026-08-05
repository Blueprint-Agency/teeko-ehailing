-- One vehicle per driver. Drops the active-vehicle indirection (a driver has
-- nothing to switch between) and enforces the rule with a unique index.
--
-- PRE-FLIGHT: the unique index fails if any driver already has 2+ vehicles.
-- Check before applying, and reconcile by hand — do not let this migration
-- decide which car to keep:
--   SELECT driver_id, count(*) FROM vehicles GROUP BY driver_id HAVING count(*) > 1;
ALTER TABLE "driver_active_vehicle" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "driver_active_vehicle" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vehicle_driver" ON "vehicles" USING btree ("driver_id");--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "is_active";
