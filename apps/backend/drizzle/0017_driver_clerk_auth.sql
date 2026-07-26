-- Driver auth migration to Clerk.
--
-- 1. PDPA 2010 consent timestamp. Captured by our own sign-up checkbox rather
--    than Clerk metadata so the consent trail stays in our DB for APAD/JPJ.
-- 2. Advisory check for duplicate driver emails. The old email+password
--    register path (now deleted) had a race-prone pre-read with no unique
--    constraint behind it, so duplicates may exist. Clerk enforces uniqueness
--    from here on. We do NOT add the unique index automatically — it would
--    fail the deploy on existing duplicates; instead we surface them.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pdpa_consent_at" timestamp with time zone;
--> statement-breakpoint
DO $$
DECLARE
  dupes integer;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT lower(email) FROM "users"
    WHERE email IS NOT NULL AND deleted_at IS NULL
    GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  IF dupes = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique_idx"
      ON "users" (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;
  ELSE
    RAISE NOTICE 'users_email_lower_unique_idx NOT created: % duplicate email group(s) present. Resolve them, then create the index manually.', dupes;
  END IF;
END $$;
