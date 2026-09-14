-- Add the 'support' value to the notification_category enum.
--
-- Support-ticket status changes made by an admin (apps/backend/src/api/admin/
-- support.routes.ts) now write a rider inbox notification. Those rows use
-- category = 'support', which the enum must allow before the insert can run.
--
-- `IF NOT EXISTS` keeps the migration a no-op on a re-run / an already-patched DB.
ALTER TYPE "public"."notification_category" ADD VALUE IF NOT EXISTS 'support';
