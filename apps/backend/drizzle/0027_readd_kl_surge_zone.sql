-- Re-add the "Kuala Lumpur City" surge zone as a properly-journaled migration.
--
-- Carried over from the orphaned 0021_add_kl_surge_zone.sql (same parallel-branch
-- collision as 0026): it existed on disk but was never in meta/_journal.json, so
-- `drizzle-kit migrate` never ran it and prod is missing the KL city surge zone
-- on the admin surge map.
--
-- A regular hexagon (~7.5 km across) centred on the KL city core. Uses
-- manual_multiplier + a far-future manual_until so the rate shows immediately,
-- matching how the seed zones in 0014 were reconciled by 0016.
--
-- Guarded on the label so a re-run is a no-op.
INSERT INTO "surge_zones"
  ("label", "polygon", "manual_multiplier", "manual_until", "active", "color", "active_from", "active_until")
SELECT * FROM (VALUES
  (
    'Kuala Lumpur City',
    'SRID=4326;POLYGON((101.7300 3.1470, 101.7125 3.1773, 101.6775 3.1773, 101.6600 3.1470, 101.6775 3.1167, 101.7125 3.1167, 101.7300 3.1470))'::geography,
    1.30,
    now() + interval '10 years',
    true,
    '#E63946',
    now(),
    now() + interval '10 years'
  )
) AS seed("label", "polygon", "manual_multiplier", "manual_until", "active", "color", "active_from", "active_until")
WHERE NOT EXISTS (SELECT 1 FROM "surge_zones" WHERE "label" = 'Kuala Lumpur City');
