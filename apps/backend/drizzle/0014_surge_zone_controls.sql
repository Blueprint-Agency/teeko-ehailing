-- ─── Surge zone admin controls ───────────────────────────────────────────────
-- Add an admin master on/off switch and a render colour to surge_zones so the
-- admin Surge Control panel can toggle zones and set multipliers.
ALTER TABLE "surge_zones" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "surge_zones" ADD COLUMN IF NOT EXISTS "color" text;
--> statement-breakpoint

-- ─── Seed demo zones (only when the table is empty) ───────────────────────────
INSERT INTO "surge_zones" ("label", "polygon", "multiplier", "active", "color", "active_from", "active_until")
SELECT * FROM (VALUES
  ('KLCC / Bukit Bintang',   'SRID=4326;POLYGON((101.712 3.158, 101.718 3.162, 101.722 3.156, 101.716 3.150, 101.710 3.152, 101.712 3.158))'::geography, 1.50, true,  '#FF5A1F', now(), now() + interval '10 years'),
  ('KL Sentral',             'SRID=4326;POLYGON((101.683 3.133, 101.690 3.137, 101.695 3.130, 101.688 3.126, 101.683 3.133))'::geography,                 1.20, true,  '#FF8C00', now(), now() + interval '10 years'),
  ('Bangsar',                'SRID=4326;POLYGON((101.668 3.125, 101.675 3.130, 101.680 3.122, 101.672 3.118, 101.668 3.125))'::geography,                 1.30, false, '#FFA500', now(), now() + interval '10 years'),
  ('Mont Kiara',             'SRID=4326;POLYGON((101.658 3.170, 101.665 3.175, 101.670 3.168, 101.662 3.163, 101.658 3.170))'::geography,                 1.00, false, '#FFD700', now(), now() + interval '10 years'),
  ('Petaling Jaya Central',  'SRID=4326;POLYGON((101.606 3.108, 101.613 3.112, 101.618 3.106, 101.610 3.101, 101.606 3.108))'::geography,                 1.20, true,  '#FF8C00', now(), now() + interval '10 years')
) AS seed("label", "polygon", "multiplier", "active", "color", "active_from", "active_until")
WHERE NOT EXISTS (SELECT 1 FROM "surge_zones");
