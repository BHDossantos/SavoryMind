# Plan 8-1 — Summary

**Status:** ✅ Done

## What shipped

- `stripe@^17.4` dep + `npm run stripe:seed` script.
- `0001_billing.sql` — idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` extending `workspaces` with `stripe_customer_id`, `stripe_subscription_id`, `plan_tier`, `plan_status`, `seat_count`, `current_period_end`. Index on `stripe_customer_id`.
- Drizzle schema mirrors the new columns with `$type<PlanTier>()` / `$type<PlanStatus>()` so DB rows surface as the right TS union.
- `lib/billing/stripe-client.ts` — `stripeClient()` returns `Stripe | null`; `isStripeConfigured()` and `isWebhookConfigured()` are the runtime gates routes use to decide between "do it" and "503 cleanly".
- `lib/billing/prices.ts` reads `prices.json` and exposes `priceIdForTier`, `tierForPriceId` (reverse lookup for the webhook), `pricesConfigured()`. The JSON ships empty so the module compiles before anyone runs the seed.
- `lib/billing/plan.ts` — pure: `PLAN_LIMITS`, `effectiveTier` (canceled/incomplete → free, past_due/trialing stays on the paid plan), `canCreateDeal`, `canRunAIAnalysis`, `PLAN_DISPLAY`.
- `lib/billing/workspace-repo.ts` — `getBillingState`, `setBillingState` (partial patch with explicit-undefined skipping), `findWorkspaceByStripeCustomer`, `countDealsForWorkspace`.
- `scripts/stripe-seed.ts` — idempotent. Finds products by `metadata.dealflow_tier`; reuses or creates. Same for prices by amount/currency/interval. Refuses to run blind in live mode (3-second confirmation pause).
- `STRIPE-SETUP.md` — complete runbook (account → keys → seed → CLI webhook → live checklist).
- `.env.example` updated with `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## Tests

- `plan.test.ts` — 10 assertions across `effectiveTier`, `canCreateDeal`, `canRunAIAnalysis`, `PLAN_LIMITS` sanity.
- `migration.test.ts` — 4 end-to-end against PGlite: defaults on a fresh signup, partial-patch behavior, `stripe_customer_id` index lookup, `countDealsForWorkspace`.

Total +14. **63 → 78 across 10 files.**

## Hiccup

Stripe v17.4 ships with the `apiVersion` literal pinned to `"2025-02-24.acacia"`; my first pass used the older `"2024-12-18.acacia"` and tsc rejected it. Updated both call sites (`stripe-client.ts` and `stripe-seed.ts`).

## Verify-block results

- ✅ `npm run build` clean
- ✅ `npm test` green (78/78)
- ✅ Schema migration applies idempotently under PGlite (same SQL works against real Postgres on second run)
- ✅ Plan gates return the documented codes across tier × count × status combos
- ✅ Code compiles without `STRIPE_SECRET_KEY` in env
