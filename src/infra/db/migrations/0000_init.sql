CREATE TYPE "public"."attribute" AS ENUM('cognition', 'psyche', 'instinct', 'constitution', 'motricity', 'perception');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('dice_roll', 'hp_change', 'pe_change', 'chat', 'player_join', 'player_leave', 'master_broadcast');--> statement-breakpoint
CREATE TYPE "public"."item_slot" AS ENUM('head', 'torso', 'arms', 'hands', 'legs', 'feet', 'ring_1', 'ring_2', 'external', 'backpack');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('weapon', 'armor', 'overlay', 'coating', 'accessory', 'consumable', 'misc');--> statement-breakpoint
CREATE TYPE "public"."proficiency_level" AS ENUM('unskilled', 'competent', 'skilled', 'expert');--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "auth_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"image_url" varchar(500),
	"invite_code" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "player_game" (
	"player_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_game_player_id_game_id_pk" PRIMARY KEY("player_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"player_id" uuid,
	"event_type" "event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"attribute" "attribute" NOT NULL,
	"description" text,
	CONSTRAINT "skill_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "character" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"nickname" varchar(150) NOT NULL,
	"epithet" varchar(100),
	"np" integer DEFAULT 1 NOT NULL,
	"cognition" integer DEFAULT -5 NOT NULL,
	"psyche" integer DEFAULT -5 NOT NULL,
	"instinct" integer DEFAULT -5 NOT NULL,
	"constitution" integer DEFAULT -5 NOT NULL,
	"motricity" integer DEFAULT -5 NOT NULL,
	"perception" integer DEFAULT -5 NOT NULL,
	"cognition_proficiency" "proficiency_level" DEFAULT 'unskilled' NOT NULL,
	"psyche_proficiency" "proficiency_level" DEFAULT 'unskilled' NOT NULL,
	"instinct_proficiency" "proficiency_level" DEFAULT 'unskilled' NOT NULL,
	"constitution_proficiency" "proficiency_level" DEFAULT 'unskilled' NOT NULL,
	"motricity_proficiency" "proficiency_level" DEFAULT 'unskilled' NOT NULL,
	"perception_proficiency" "proficiency_level" DEFAULT 'unskilled' NOT NULL,
	"max_hp" integer DEFAULT 0 NOT NULL,
	"max_effort" integer DEFAULT 0 NOT NULL,
	"b_exp" integer DEFAULT 0 NOT NULL,
	"current_hp" integer DEFAULT 0 NOT NULL,
	"current_effort" integer DEFAULT 0 NOT NULL,
	"hair_color" varchar(50),
	"height_cm" integer,
	"weight_kg" numeric(5, 2),
	"size" varchar(30),
	"background" text,
	"profession" varchar(100),
	"motivation" text,
	"affliction" text,
	"personality" varchar(50),
	"posture" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_np_check" CHECK ("character"."np" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE TABLE "character_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "item_type" NOT NULL,
	"slot" "item_slot" DEFAULT 'backpack' NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"attributes" jsonb
);
--> statement-breakpoint
CREATE TABLE "character_skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"proficiency_bonus" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "character_skill_unique" UNIQUE("character_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_master_id_player_id_fk" FOREIGN KEY ("master_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game" ADD CONSTRAINT "player_game_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game" ADD CONSTRAINT "player_game_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_log" ADD CONSTRAINT "session_log_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_log" ADD CONSTRAINT "session_log_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character" ADD CONSTRAINT "character_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character" ADD CONSTRAINT "character_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_item" ADD CONSTRAINT "character_item_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_skill" ADD CONSTRAINT "character_skill_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_skill" ADD CONSTRAINT "character_skill_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_session_player_idx" ON "auth_session" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "auth_session_expires_idx" ON "auth_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "game_master_idx" ON "game" USING btree ("master_id");--> statement-breakpoint
CREATE INDEX "game_invite_code_idx" ON "game" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "player_game_game_idx" ON "player_game" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "session_game_idx" ON "session" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_active_game_unique" ON "session" USING btree ("game_id") WHERE "session"."is_active";--> statement-breakpoint
CREATE INDEX "session_log_session_idx" ON "session_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_log_player_idx" ON "session_log" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "character_player_idx" ON "character" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "character_game_idx" ON "character" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "character_item_character_idx" ON "character_item" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "character_skill_skill_idx" ON "character_skill" USING btree ("skill_id");