# Phase 8 — Verification

## Phase goal recap

Wire Stripe-backed billing onto the multi-tenant backend so the product
can take money. Free / Pro / Team tiers with feature gates enforced
**server-side**. Code ships ready to flip on; the only thing blocking
activation is the user pasting Stripe keys into `.env.local` and running
the seed script.

## Did the codebase deliver?

| Goal                                                        | Status |
| ----------------------------------------------------------- | ------ |
| Billing columns on `workspaces` + migration                 | ✅     |
| Idempotent product/price seed script                        | ✅     |
| Stripe client wrapper (lazy, null when keys absent)         | ✅     |
| Plan-tier source of truth + gate helpers                    | ✅     |
| Checkout / Portal / Webhook / Workspace API routes          | ✅     |
| Feature gates on `/api/deals` POST + `/api/ai-analysis` POST | ✅     |
| Pricing / Success / Settings UI                             | ✅     |
| Setup runbook (`STRIPE-SETUP.md`)                           | ✅     |
| "Keys absent" UX (503 + disabled CTAs, no 500s)             | ✅     |
| `npm run build` clean                                       | ✅ 17 routes |
| `npm test` green                                            | ✅ 88 passing across 12 files |

## Test totals

```
Test Files  12 passed (12)
     Tests  88 passed (88)
```

| File                                              | New | Notes                                                            |
| ------------------------------------------------- | --- | ---------------------------------------------------------------- |
| `lib/billing/__test__/plan.test.ts`               | 10  | Pure gate matrix                                                 |
| `lib/billing/__test__/migration.test.ts`          | 4   | PGlite — defaults, partial-patch, customer-id index, deal count  |
| `lib/billing/__test__/webhook-dispatch.test.ts`   | 8   | Every event type + the price→tier fallback                       |
| `lib/billing/__test__/gates.test.ts`              | 2   | PGlite — free→pro upgrade unlocks deal #4 and AI                 |

## Pending live UAT (post-key-paste)

These are the scripted checks for whoever runs the live test once
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL`
are populated and `npm run stripe:seed` has been run.

1. `npm run db:up && npm run db:migrate` — DB up + billing migration applied.
2. `npm run stripe:seed` — Stripe products and prices created in test mode; `lib/billing/prices.json` updated.
3. `stripe listen --forward-to localhost:3000/api/billing/webhook` — CLI relay running.
4. `npm run dev`, sign up at `/signup`.
5. Header should show a "Free" PlanBadge.
6. Add a deal → succeeds. Add 2 more → succeeds. Try a 4th → server 402, dashboard renders upgrade prompt.
7. `/pricing` → click Upgrade to Pro → Stripe Checkout opens → pay with `4242 4242 4242 4242`.
8. Land on `/billing/success`. Page should flip from "Activating…" to the celebration state within ~3 seconds.
9. Header badge now reads "Pro".
10. Re-attempt the 4th deal → succeeds.
11. AI Analysis section now shows the Generate button (no more upgrade prompt).
12. `/settings/billing` → "Manage subscription" → lands on Stripe customer portal.
13. From the portal, cancel the subscription → return to settings → `planStatus = "canceled"`, badge drops back to "Free" at period end (Stripe behavior).
14. Without keys: every flow above either degrades gracefully (503 with a message, disabled CTAs) or stays on Free — no 500s.

## Authorization walls

**This is the first phase that hits an authorization wall.** Everything
in Phase 8 ships green from a code perspective; activation requires the
user to:

1. Create a Stripe account (free, ~5 minutes).
2. Drop two keys into `dealflow/.env.local` (`STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`).
3. Run `npm run stripe:seed` once.
4. (For prod) Configure the webhook endpoint in the Stripe dashboard.

`STRIPE-SETUP.md` is the runbook. Until those steps happen, the product
keeps working at Free tier with a small "Billing not configured" caption
under the Upgrade buttons.

## Follow-ups added to STATE

- **T9.** Test-mode vs live-mode `prices.json` are currently a single file. Production deploy will need an env-specific resolution. Cheap fix: read `lib/billing/prices.test.json` when key starts with `sk_test_`, otherwise `prices.live.json`. Or one file per environment in the deploy config.
- **T10.** Email receipts: Stripe sends its own, but our branded receipt + welcome email belongs in Phase 9 (needs an email provider).
- **T11.** Annual billing toggle on the pricing page. Skip until we have churn data to optimize against.
- **T12.** Team-tier invite flow + member roles (Phase 11).
- **T13.** Quota dashboard widget — "X / 3 deals used" — minor UX polish, not blocking.
