-- Phase 8: billing columns on workspaces. Idempotent so dev DBs can
-- catch up without resetting.

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "plan_tier" text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "plan_status" text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "seat_count" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "current_period_end" timestamp;

CREATE INDEX IF NOT EXISTS "workspaces_stripe_customer_idx"
  ON "workspaces" ("stripe_customer_id");
