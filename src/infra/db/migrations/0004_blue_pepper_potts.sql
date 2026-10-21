CREATE TYPE "public"."combatant_kind" AS ENUM('character', 'monster');--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'combat_state';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'test_declared';--> statement-breakpoint
CREATE TABLE "monster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"np" integer DEFAULT 1 NOT NULL,
	"max_hp" integer DEFAULT 0 NOT NULL,
	"current_hp" integer DEFAULT 0 NOT NULL,
	"max_effort" integer DEFAULT 0 NOT NULL,
	"current_effort" integer DEFAULT 0 NOT NULL,
	"size" varchar(30),
	"cognition" integer DEFAULT -5 NOT NULL,
	"psyche" integer DEFAULT -5 NOT NULL,
	"instinct" integer DEFAULT -5 NOT NULL,
	"constitution" integer DEFAULT -5 NOT NULL,
	"motricity" integer DEFAULT -5 NOT NULL,
	"perception" integer DEFAULT -5 NOT NULL,
	"height_cm" integer,
	"weight_kg" numeric(5, 2),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monster_np_check" CHECK ("monster"."np" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE TABLE "combat_state" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"turn_index" integer DEFAULT 0 NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combatant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "combatant_kind" NOT NULL,
	"ref_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"initiative_value" integer,
	"has_rolled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "combatant_session_kind_ref_unique" UNIQUE("session_id","kind","ref_id")
);
--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "afflictions" text[];--> statement-breakpoint
UPDATE "character" SET "afflictions" = ARRAY["affliction"] WHERE "affliction" IS NOT NULL AND "affliction" <> '';--> statement-breakpoint
ALTER TABLE "monster" ADD CONSTRAINT "monster_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monster" ADD CONSTRAINT "monster_created_by_player_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat_state" ADD CONSTRAINT "combat_state_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combatant" ADD CONSTRAINT "combatant_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monster_game_idx" ON "monster" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "combatant_session_idx" ON "combatant" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "character" DROP COLUMN "affliction";