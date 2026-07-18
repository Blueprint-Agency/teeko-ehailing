-- Undo the short-lived column from the earlier draft of this migration.
ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "commission_rate_bps";

-- Clean up the old pricing_config key that was seeded in the same draft.
DELETE FROM "pricing_config" WHERE "key" = 'commission_rate_bps';

-- ─── Commission scope enum ───────────────────────────────────────────────────
CREATE TYPE "public"."commission_scope" AS ENUM ('platform', 'category', 'driver');

-- ─── Commission configs table ────────────────────────────────────────────────
-- One row per (scope, scope_key). Resolution priority: driver > category > platform.
-- scope_key values:
--   platform → '__platform__'
--   category → ride category name ('go', 'comfort', 'xl', 'premium', 'bike')
--   driver   → driver user UUID
CREATE TABLE "commission_configs" (
  "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope"      "commission_scope"                               NOT NULL,
  "scope_key"  text                                             NOT NULL,
  "rate_bps"   integer                                          NOT NULL
                 CHECK ("rate_bps" BETWEEN 500 AND 4000),
  "note"       text,
  "updated_by" uuid REFERENCES "users" ("id"),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_commission_scope_key" UNIQUE ("scope", "scope_key")
);

-- ─── Seed platform default: 20% ──────────────────────────────────────────────
INSERT INTO "commission_configs" ("scope", "scope_key", "rate_bps")
VALUES ('platform', '__platform__', 2000)
ON CONFLICT ON CONSTRAINT "uq_commission_scope_key" DO NOTHING;
