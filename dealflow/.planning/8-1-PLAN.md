# Plan 8-1 — Schema, Stripe client, seed script, plan-gate logic

<plan>
  <name>Billing foundation: DB schema, Stripe wrapper, idempotent product seed, plan helpers</name>
  <wave>1</wave>
  <depends_on>Phase 6 schema</depends_on>
  <files>
    <write>dealflow/package.json</write>
    <write>dealflow/.env.example</write>
    <write>dealflow/lib/db/schema.ts</write>
    <write>dealflow/lib/db/migrations/0001_billing.sql</write>
    <write>dealflow/lib/billing/types.ts</write>
    <write>dealflow/lib/billing/stripe-client.ts</write>
    <write>dealflow/lib/billing/prices.ts</write>
    <write>dealflow/lib/billing/plan.ts</write>
    <write>dealflow/lib/billing/workspace-repo.ts</write>
    <write>dealflow/scripts/stripe-seed.ts</write>
    <write>dealflow/STRIPE-SETUP.md</write>
    <write>dealflow/lib/billing/__test__/plan.test.ts</write>
    <write>dealflow/lib/billing/__test__/migration.test.ts</write>
  </files>
  <action>
    1. Add `stripe@^17` to dependencies.
    2. Extend schema: workspaces gains stripeCustomerId, stripeSubscriptionId,
       planTier ("free" default), planStatus ("active" default), seatCount (1
       default), currentPeriodEnd. Add unique index on stripeCustomerId
       (where not null).
    3. 0001_billing.sql — idempotent ALTER TABLE ... ADD COLUMN IF NOT EXISTS
       for each new column. PGlite + Postgres both support this.
    4. lib/billing/types.ts — PlanTier, PlanStatus, GateResult, BillingState.
    5. lib/billing/stripe-client.ts — exports stripeClient() returning a
       lazily-constructed Stripe instance or null when keys absent.
       isStripeConfigured() helper.
    6. lib/billing/prices.ts — exports PRICES with productId + priceId for
       Pro and Team, plus tierForPriceId(priceId). Reads from
       lib/billing/prices.json (which the seed script writes); falls back
       to a placeholder shape so the module compiles before the seed runs.
    7. lib/billing/plan.ts — PLAN_LIMITS, canCreateDeal(workspace, count),
       canRunAIAnalysis(workspace), effectiveTier(workspace) — pure
       functions over the BillingState shape.
    8. lib/billing/workspace-repo.ts — getBillingState(db, workspaceId),
       setBillingState(db, workspaceId, patch).
    9. scripts/stripe-seed.ts — idempotent. Looks for existing products by
       metadata.dealflow_tier; reuses or creates. Same for prices by metadata.
       Writes lib/billing/prices.json. Logs which Stripe mode (test vs live).
    10. STRIPE-SETUP.md — step-by-step runbook (account, keys, env vars,
        seed command, webhook setup for dev + prod).
    11. Tests: plan.test.ts covers the gate matrix; migration.test.ts boots
        PGlite, applies both migrations, asserts billing columns exist with
        correct defaults.
  </action>
  <verify>
    - npm run build clean
    - npm test green (target +8 new tests)
    - Schema migration applies under PGlite
    - lib/billing modules compile under strict TS
    - Plan gates return the expected codes for tier × count × status combos
  </verify>
  <done>
    - All billing scaffolding committed
    - Code compiles without STRIPE_SECRET_KEY in env
    - Seed script runnable (manual UAT — covered in summary)
  </done>
</plan>
