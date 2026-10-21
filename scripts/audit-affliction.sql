-- Read-only audit of the `character.affliction` -> `afflictions` migration.
-- Prints the legacy column state, the rows that still need carrying over and a
-- one-line verdict: ok | needs-backfill | legacy-column-already-dropped.
DO $$
DECLARE
  has_legacy boolean := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'character' AND column_name = 'affliction'
  );
  has_new boolean := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'character' AND column_name = 'afflictions'
  );
  legacy_rows bigint := 0;
  pending bigint := 0;
  empty_new bigint := 0;
  verdict text;
BEGIN
  IF has_new THEN
    EXECUTE 'SELECT count(*) FROM "character" WHERE "afflictions" IS NULL OR cardinality("afflictions") = 0'
      INTO empty_new;
  END IF;

  IF has_legacy THEN
    EXECUTE 'SELECT count(*) FROM "character" WHERE "affliction" IS NOT NULL AND "affliction" <> '''''
      INTO legacy_rows;
  END IF;

  IF has_legacy AND has_new THEN
    EXECUTE 'SELECT count(*) FROM "character" WHERE "affliction" IS NOT NULL AND "afflictions" IS NULL'
      INTO pending;
  ELSIF has_legacy THEN
    pending := legacy_rows;
  END IF;

  IF NOT has_legacy THEN
    verdict := 'legacy-column-already-dropped';
  ELSIF pending > 0 THEN
    verdict := 'needs-backfill';
  ELSE
    verdict := 'ok';
  END IF;

  RAISE NOTICE 'legacy column "affliction" present: %', CASE WHEN has_legacy THEN 'yes' ELSE 'no' END;
  RAISE NOTICE 'rows carrying a legacy value: %', legacy_rows;
  RAISE NOTICE 'rows with empty/NULL "afflictions": %', empty_new;
  RAISE NOTICE 'rows still pending backfill: %', pending;
  RAISE NOTICE 'verdict: %', verdict;
END $$;
