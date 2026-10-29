ALTER TABLE "monster" ALTER COLUMN "game_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "monster" m SET "created_by" = g."master_id" FROM "game" g
WHERE m."game_id" = g."id" AND m."created_by" IS NULL;--> statement-breakpoint
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "monster" WHERE "created_by" IS NULL) THEN
  RAISE EXCEPTION 'monster rows without owner after backfill'; END IF; END $$;--> statement-breakpoint
ALTER TABLE "monster" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "current_hp" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "max_hp" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "current_effort" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "max_effort" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "afflictions" text[];--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "cognition" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "psyche" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "instinct" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "constitution" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "motricity" integer;--> statement-breakpoint
ALTER TABLE "combatant" ADD COLUMN "perception" integer;--> statement-breakpoint
UPDATE "combatant" c SET current_hp = m.current_hp, max_hp = m.max_hp,
  current_effort = m.current_effort, max_effort = m.max_effort
FROM "monster" m, "session" s
WHERE c.kind = 'monster' AND c.ref_id = m.id AND s.id = c.session_id
  AND m.game_id = s.game_id AND c.current_hp IS NULL;--> statement-breakpoint
UPDATE "combatant" c SET cognition = m.cognition, psyche = m.psyche,
  instinct = m.instinct, constitution = m.constitution,
  motricity = m.motricity, perception = m.perception
FROM "monster" m, "session" s
WHERE c.kind = 'monster' AND c.ref_id = m.id AND s.id = c.session_id
  AND m.game_id = s.game_id AND c.cognition IS NULL;--> statement-breakpoint
CREATE INDEX "monster_owner_idx" ON "monster" USING btree ("created_by");