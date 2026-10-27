-- ALTER COLUMN ... USING cannot contain a subquery ("cannot use subquery in
-- transform expression"), so the split is done with regexp_split_to_array.
ALTER TABLE "character"
  ALTER COLUMN "bonds" TYPE text[]
  USING CASE
    WHEN "bonds" IS NULL OR btrim("bonds") = '' THEN NULL
    ELSE array_remove(regexp_split_to_array(btrim("bonds"), '\s*,\s*'), '')
  END;
