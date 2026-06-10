# Phase 8 — Research

## Schema additions

New columns on `workspaces`:

```ts
stripeCustomerId: text("stripe_customer_id")           // null until first checkout
stripeSubscriptionId: text("stripe_subscription_id")    // null on free
planTier: text("plan_tier")                             // "free" | "pro" | "team"
  .notNull().default("free")
planStatus: text("plan_status")                         // active | past_due | canceled | trialing | incomplete
  .notNull().default("active")
seatCount: integer("seat_count").notNull().default(1)   // team-tier quantity
currentPeriodEnd: timestamp("current_period_end", { mode: "date" })
```

One migration file `0001_billing.sql` with idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. PGlite supports these.

## Stripe SDK shape

```ts
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" })
  : null;
```

Centralized in `lib/billing/stripe-client.ts`. All callers branch on `stripe === null`.

## Routes

| Route                           | Method | Purpose                                                                                              |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `/api/billing/checkout`         | POST   | Body: `{ tier: "pro" \| "team", seatCount?: number }`. Creates a Checkout Session, returns `{ url }`. |
| `/api/billing/portal`           | POST   | Creates a Customer Portal session for the workspace owner, returns `{ url }`.                          |
| `/api/billing/webhook`          | POST   | Verifies signature, dispatches by event type, returns 200 even on no-op (Stripe expects 2xx).         |
| `/api/billing/workspace`        | GET    | Returns the caller's workspace plan state. Used by UI to render the right CTAs.                       |

All require auth except the webhook (which uses Stripe's signature instead).

## Webhook events handled

| Event                              | Action                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `checkout.session.completed`       | Pull `client_reference_id` (= workspaceId), retrieve the subscription, write plan fields.       |
| `customer.subscription.created`    | Mirror to workspace.                                                                            |
| `customer.subscription.updated`    | Mirror plan changes (tier swap, seat count, status transitions, period end).                    |
| `customer.subscription.deleted`    | Drop workspace back to `free`, clear `stripeSubscriptionId`.                                    |
| `invoice.paid`                     | Touch `planStatus = "active"`.                                                                  |
| `invoice.payment_failed`           | Set `planStatus = "past_due"` — UI surfaces a banner; server-side gate stays open until Stripe cancels. |

Map Stripe `price.id` back to the tier via `lib/billing/prices.ts` so the webhook doesn't have to guess.

## Feature gates

Pure helper in `lib/billing/plan.ts`:

```ts
export const PLAN_LIMITS = {
  free: { maxDeals: 3, aiAnalysis: false },
  pro:  { maxDeals: Infinity, aiAnalysis: true },
  team: { maxDeals: Infinity, aiAnalysis: true },
} as const;

export function canCreateDeal(workspace, currentDealCount): GateResult { ... }
export function canRunAIAnalysis(workspace): GateResult { ... }
```

`GateResult` is `{ ok: true } | { ok: false, reason: string, code: "deal_limit" | "ai_not_in_plan" | "subscription_inactive" }`.

API consumers (`/api/deals` POST, `/api/ai-analysis` POST) check the gate and 402 on deny with `{ upgrade: true, code, currentTier, limit? }`.

## Idempotent seed script

`scripts/stripe-seed.ts` (run via `tsx`):

1. Reads `STRIPE_SECRET_KEY`. Exits with helpful message if missing.
2. For each of Pro + Team:
   - Look for an existing Product with `metadata.dealflow_tier = <tier>`. If found, use it.
   - Otherwise create the product (`name`, `metadata`).
   - Look for an active Price on that product matching expected amount/interval/currency. If found, use it.
   - Otherwise create the price.
3. Writes the four resolved IDs (`pro_product_id`, `pro_price_id`, `team_product_id`, `team_price_id`) to `lib/billing/prices.json` (committed; safe to share — these are public IDs, not secrets).
4. Idempotent across runs.

## Webhook signature verification — minimal SDK use

```ts
const sig = req.headers.get("stripe-signature");
const body = await req.text();  // verifyConstructEvent needs raw body
const event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
```

Route opts out of Next.js body parsing by calling `req.text()` directly (Route Handlers give us the raw stream by default; no `bodyParser: false` config needed in App Router).

## Tests

Pure-logic tests:
- `lib/billing/plan.test.ts` — gate matrix across tier × deal count × plan status.
- `lib/billing/__test__/webhook-dispatch.test.ts` — given a parsed event, the dispatcher writes the right workspace fields. Mocks the Stripe lib for `prices.id → tier` lookup.
- `lib/billing/__test__/migration.test.ts` — applies `0001_billing.sql` over the base PGlite harness; columns exist with correct defaults.

The actual `stripe.webhooks.constructEvent` is exercised via integration only (mocked in tests; live UAT after key paste).

## Risks

- **Webhook race**: a user could hit the success page before Stripe delivers `checkout.session.completed`. Mitigation: success page polls `/api/billing/workspace` every 2s up to 10s, then surfaces "still processing — refresh in a minute" if it hasn't flipped.
- **Forgetting to seed prices**: webhook would receive a price.id it can't map. Mitigation: webhook logs a clear warning + 200s (so Stripe doesn't retry forever), and `STRIPE-SETUP.md` makes seed step #2 of #2.
- **Test-mode keys in production**: `STRIPE-SETUP.md` calls this out twice. The seed script also logs which mode (`sk_test_` vs `sk_live_`) it's using.
- **Apparent-but-not-real cancellation**: Stripe's `customer.subscription.deleted` fires at period end by default. If we listened to the "request to cancel" event we'd cut access early. Defaulting to "deleted only" matches the user's paid-through date.
