-- Reverses 0006_perfect_puck. Refuses while reusable entries (game_id IS NULL)
-- exist, naming their count.
DO $$ DECLARE reusable_count integer; BEGIN
  SELECT count(*) INTO reusable_count FROM "monster" WHERE "game_id" IS NULL;
  IF reusable_count > 0 THEN
    RAISE EXCEPTION 'rollback refused: % reusable monster entries (game_id IS NULL) exist', reusable_count;
  END IF;
END $$;
ALTER TABLE "monster" ALTER COLUMN "game_id" SET NOT NULL;
ALTER TABLE "monster" ALTER COLUMN "created_by" DROP NOT NULL;
DROP INDEX IF EXISTS "monster_owner_idx";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "current_hp";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "max_hp";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "current_effort";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "max_effort";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "afflictions";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "cognition";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "psyche";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "instinct";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "constitution";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "motricity";
ALTER TABLE "combatant" DROP COLUMN IF EXISTS "perception";