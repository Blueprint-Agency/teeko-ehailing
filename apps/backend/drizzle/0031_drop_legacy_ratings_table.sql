-- The standalone `ratings` table was never written to — ratings live on
-- `trips` (rider_rating / driver_rating, see 0008 and 0030). Drop it so the
-- PDPA export/erasure paths have one source of truth.

DROP TABLE IF EXISTS "ratings";
