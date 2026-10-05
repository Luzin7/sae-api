CREATE TYPE "public"."social_class" AS ENUM('opulento', 'abastado', 'plebeu', 'miseravel');--> statement-breakpoint
ALTER TYPE "public"."proficiency_level" RENAME VALUE 'unskilled' TO 'imperito';--> statement-breakpoint
ALTER TYPE "public"."proficiency_level" RENAME VALUE 'competent' TO 'competente';--> statement-breakpoint
ALTER TYPE "public"."proficiency_level" RENAME VALUE 'skilled' TO 'versado';--> statement-breakpoint
ALTER TYPE "public"."proficiency_level" RENAME VALUE 'expert' TO 'especialista';--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "social_class" "social_class";--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "vaalaques" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "bonds" text;
