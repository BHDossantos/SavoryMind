# Phase 8 — Context

**Goal.** Wire Stripe-backed billing onto the multi-tenant backend so the
product can take money. Free / Pro / Team tiers with feature gates
enforced server-side. Code ships ready to flip on; the only thing
blocking activation is the user pasting their Stripe API keys into
`.env.local`.

## Decisions

| #   | Decision                                | Choice                                                                                                                       |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| C1  | Subscription owner                      | **Workspaces** — paying entity. Matches D12 ("Team tier is a data-only change"). Users without paid workspaces stay on free. |
| C2  | Tiers                                   | **Free / Pro €29 / Team €99 per seat**. Free: 3 deals, no AI. Pro: unlimited deals, unlimited AI. Team: same + multi-member.  |
| C3  | Stripe SDK                              | **`stripe@^17`** server-side. No client-side Stripe.js in Phase 8 (Checkout hosted by Stripe; user is redirected).             |
| C4  | Checkout                                | **Stripe Checkout Sessions** — fully hosted. Reduces compliance surface and ships fastest.                                   |
| C5  | Customer portal                         | **Stripe-hosted Customer Portal**. Same reason as C4.                                                                         |
| C6  | Webhooks                                | One handler at `/api/billing/webhook` covering checkout.session.completed, customer.subscription.{created,updated,deleted}, invoice.{paid,payment_failed}. Signature verified with `STRIPE_WEBHOOK_SECRET`. |
| C7  | Feature gating                          | **Server-side at the API boundary** — `/api/deals` POST and `/api/ai-analysis` POST consult the workspace's plan tier. UI also gates buttons, but the server is the source of truth. |
| C8  | "Keys absent" UX                        | Every billing endpoint returns 503 with a clear message; UI shows the pricing page either way but disables Upgrade CTAs. Mirrors the Phase 4 AI fallback pattern. |
| C9  | Stripe product/price seeding            | **Idempotent seed script** (`npm run stripe:seed`) reads `STRIPE_SECRET_KEY`, creates products + prices in the connected account if missing, writes IDs back to `lib/billing/prices.ts`. User pastes keys; runs one command; products exist. |
| C10 | Plan tier source of truth               | `workspaces.plan_tier` column. Webhook writes; reads via `lib/billing/plan.ts`. SWR cache invalidation on the client after a successful checkout return.        |
| C11 | Trial                                   | **No free trial in Phase 8** — free tier IS the trial. Avoids needing a credit card to evaluate.                              |
| C12 | Proration                               | **Stripe default** — Checkout handles upgrades/downgrades through the customer portal.                                       |
| C13 | Currency                                | **EUR** matches the rest of the product. Multi-currency deferred to Phase 11.                                                |
| C14 | Setup automation                        | `STRIPE-SETUP.md` walks through: account creation, key location, env var paste, `npm run stripe:seed`, webhook setup (Stripe CLI for dev, dashboard for prod). |
| C15 | Tests                                   | Plan-gate logic (pure), webhook signature verification (mocked Stripe lib), repo CRUD. End-to-end Stripe flow is manual UAT.  |

## Out of scope for Phase 8

- Email receipts (Stripe sends its own; custom branding is Phase 10).
- Tax (Stripe Tax is a one-checkbox add-on later).
- Annual billing (Phase 11 — when we have churn data to optimize against).
- Multi-currency.
- Team tier UI: invite members, role management. Schema and gate ready; UI lands in Phase 11.
- Real OAuth providers for login (still credentials-only).

## Edge cases

- **Webhook delivered before user lands on the success page** → workspace already on Pro by the time UI revalidates. Fine.
- **Webhook delivered after user lands on success page** → success page shows "Activating…" until `mutate(workspaceKey)` returns the new plan. We poll with SWR's revalidate on focus.
- **Subscription canceled mid-period** → Stripe sends `customer.subscription.deleted` at period end (default). Until then, `current_period_end` keeps the workspace on Pro/Team.
- **Payment fails** → Stripe retries per dunning settings; webhook updates `plan_status = "past_due"`. Server-side gate stays on Pro until subscription actually transitions to `canceled` (matches Stripe's grace period).
- **Free-tier user hits deal #4** → API returns 402 with `{ upgrade: true, currentTier: "free", limit: 3 }`. UI redirects to `/pricing?from=deals`.
- **Keys absent in dev** → app keeps working at Free tier; pricing page renders with disabled Upgrade buttons + a banner ("Stripe not configured locally"). No 500s.
