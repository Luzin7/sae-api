SET LOCAL lock_timeout = '5s';--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "character" WHERE "max_effort" < 0)
  OR EXISTS (SELECT 1 FROM "monster" WHERE "max_effort" < 0)
  OR EXISTS (SELECT 1 FROM "combatant" WHERE "max_effort" < 0) THEN
  RAISE EXCEPTION 'negative max_effort found; fix before adding effort range checks'; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_effort_range_check') THEN
  UPDATE "character" SET "current_effort" = 0 WHERE "current_effort" <> 0;
  ALTER TABLE "character" ADD CONSTRAINT "character_effort_range_check" CHECK ("character"."current_effort" >= 0 AND "character"."current_effort" <= "character"."max_effort");
END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monster_effort_range_check') THEN
  UPDATE "monster" SET "current_effort" = 0 WHERE "current_effort" <> 0;
  ALTER TABLE "monster" ADD CONSTRAINT "monster_effort_range_check" CHECK ("monster"."current_effort" >= 0 AND "monster"."current_effort" <= "monster"."max_effort");
END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'combatant_effort_range_check') THEN
  UPDATE "combatant" SET "current_effort" = 0 WHERE "current_effort" IS NOT NULL AND "current_effort" <> 0;
  ALTER TABLE "combatant" ADD CONSTRAINT "combatant_effort_range_check" CHECK ("combatant"."current_effort" IS NULL OR "combatant"."max_effort" IS NULL OR ("combatant"."current_effort" >= 0 AND "combatant"."current_effort" <= "combatant"."max_effort"));
END IF; END $$;
