SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN IF NOT EXISTS "family_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN IF NOT EXISTS "used_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN IF NOT EXISTS "replaced_by_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_session_family_idx" ON "auth_session" USING btree ("family_id");
