SET LOCAL lock_timeout = '5s';--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monster_size_check') THEN
  UPDATE "monster" SET "size" = CASE translate(lower(btrim("size")), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
    WHEN 'miudo' THEN 'miudo'
    WHEN 'pequeno' THEN 'pequeno'
    WHEN 'medio' THEN 'medio'
    WHEN 'grande' THEN 'grande'
    WHEN 'enorme' THEN 'enorme'
    ELSE NULL END
  WHERE "size" IS NOT NULL;
  ALTER TABLE "monster" ADD CONSTRAINT "monster_size_check" CHECK ("monster"."size" IS NULL OR "monster"."size" IN ('miudo', 'pequeno', 'medio', 'grande', 'enorme'));
END IF; END $$;
