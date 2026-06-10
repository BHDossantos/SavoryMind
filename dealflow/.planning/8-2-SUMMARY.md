# Plan 8-2 — Summary

**Status:** ✅ Done

## What shipped

Four billing routes + enforcement on the two write paths that consume plan quota.

- `POST /api/billing/checkout` — `requireSession`, validate `tier in {pro, team}`, lazy-create + cache `stripeCustomerId` on the workspace, create a Stripe Checkout Session with `client_reference_id = workspaceId`, `success_url=/billing/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url=/pricing?from=checkout`. Allows promo codes. Subscription metadata carries `workspace_id` + `tier` so the webhook can still reconcile if the client reference is ever lost. Returns 503 when keys are absent.
- `POST /api/billing/portal` — `requireSession`, fetch the workspace's `stripeCustomerId`, create a Customer Portal session, return `{ url }`. 400 if the workspace has never subscribed.
- `POST /api/billing/webhook` — raw body via `req.text()`; verify the `stripe-signature` header through `stripe.webhooks.constructEvent`; dispatch via pure `lib/billing/webhook-dispatch.ts`; **always 2xx on accepted signatures** so Stripe doesn't retry on DB write hiccups (those get console.error'd and dropped).
- `GET /api/billing/workspace` — returns `{ billing, effectiveTier, dealCount, limits, stripeConfigured }` for UI rendering.

Plus the pure dispatcher itself (`lib/billing/webhook-dispatch.ts`):

| Event                              | Patch written                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `checkout.session.completed`       | `{ stripeCustomerId }`                                                       |
| `customer.subscription.created`    | `{ stripeSubscriptionId, planTier (via price→tier), planStatus, seatCount, currentPeriodEnd }` |
| `customer.subscription.updated`    | (same shape)                                                                 |
| `customer.subscription.deleted`    | `{ planTier: "free", planStatus: "canceled", stripeSubscriptionId: null, seatCount: 1, currentPeriodEnd: null }` |
| `invoice.paid`                     | `{ planStatus: "active" }`                                                   |
| `invoice.payment_failed`           | `{ planStatus: "past_due" }`                                                 |
| anything else                      | `null` (logged as "ignored event type X")                                     |

Plus the gate wiring on existing routes:

- `/api/deals` POST runs `canCreateDeal(state, count)` after validating the payload. On deny: 402 with `{ error, code, upgrade: true, currentTier, limit }`.
- `/api/ai-analysis` POST checks `auth()` first — anonymous callers get 402 immediately. Authenticated callers run `canRunAIAnalysis(state)`; deny → 402.

## Tests

- `webhook-dispatch.test.ts` — 8: every event type, the price→tier reverse mapping (including the "unknown price falls back to free" guard), and the `past_due` status preservation.
- `gates.test.ts` — 2 end-to-end PGlite: free tier blocks deal #4 and unblocks after `setBillingState({ planTier: "pro" })`; AI gate flips with the plan.

Total +10. **78 → 88 across 12 files.**

## Verify-block results

- ✅ `npm run build` clean — the four new routes show up in the output
- ✅ `npm test` green (88/88)
- ✅ Free-tier workspace blocked at deal #4 via the gate function
- ✅ `canRunAIAnalysis` returns false for free, true for pro/team
- ✅ Webhook dispatcher writes the right patch for each event type
- ✅ All billing routes 503 cleanly when keys are absent
