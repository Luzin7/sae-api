ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN IF NOT EXISTS "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "monster" ADD COLUMN IF NOT EXISTS "client_request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "character_player_client_request_uq" ON "character" USING btree ("player_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monster_creator_client_request_uq" ON "monster" USING btree ("created_by","client_request_id");