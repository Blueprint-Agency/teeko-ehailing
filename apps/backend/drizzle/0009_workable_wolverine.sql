-- 0009 was an accidental duplicate of 0007+0008: `pnpm db:generate` ran against a
-- stale meta snapshot and re-emitted the whole payment system. All its objects
-- already exist from 0007/0008, so CREATE TYPE failed (42710). Neutralized to a
-- no-op; meta/0009_snapshot.json remains the correct baseline for future diffs.
SELECT 1;
