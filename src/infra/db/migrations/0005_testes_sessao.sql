ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'test_closed';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_log_test_roll_unique" ON "session_log"
  ((payload->>'testId'), (payload->>'characterId'))
  WHERE event_type = 'dice_roll' AND (payload->>'testId') IS NOT NULL AND (payload->>'characterId') IS NOT NULL;
