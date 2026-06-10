# Plan 8-2 — Billing API routes + feature gates

<plan>
  <name>API surface: checkout, portal, webhook, workspace state — plus server-side feature gates</name>
  <wave>2</wave>
  <depends_on>8-1</depends_on>
  <files>
    <write>dealflow/app/api/billing/checkout/route.ts</write>
    <write>dealflow/app/api/billing/portal/route.ts</write>
    <write>dealflow/app/api/billing/webhook/route.ts</write>
    <write>dealflow/app/api/billing/workspace/route.ts</write>
    <write>dealflow/app/api/deals/route.ts</write>
    <write>dealflow/app/api/ai-analysis/route.ts</write>
    <write>dealflow/lib/billing/webhook-dispatch.ts</write>
    <write>dealflow/lib/billing/__test__/webhook-dispatch.test.ts</write>
    <write>dealflow/lib/billing/__test__/gates.test.ts</write>
  </files>
  <action>
    1. /api/billing/checkout (POST): requireSession; validate tier in
       {pro, team}; create or reuse Stripe customer for the workspace; create
       Checkout Session with client_reference_id=workspaceId,
       success_url=/billing/success, cancel_url=/pricing?from=checkout.
       503 with clear message if STRIPE_SECRET_KEY missing.
    2. /api/billing/portal (POST): requireSession; ensure workspace has
       stripeCustomerId; create Customer Portal session; return { url }.
       503 if not configured or no customer yet (returns 400 "no subscription").
    3. /api/billing/webhook (POST): read raw body via req.text(); verify
       stripe-signature; dispatch through lib/billing/webhook-dispatch.ts;
       always return 2xx unless signature fails (then 400). 503 if
       STRIPE_WEBHOOK_SECRET missing.
    4. /api/billing/workspace (GET): returns BillingState for caller's
       workspace — { tier, status, currentPeriodEnd, seatCount, limits }.
       Used by UI to render correct CTAs and the dashboard plan badge.
    5. lib/billing/webhook-dispatch.ts (pure given a parsed event +
       db handle): event-type → BillingState patch. Handles all the events
       listed in 8-RESEARCH. Returns a {action, workspaceId, patch} record
       so the test can assert on it directly.
    6. Update /api/deals POST: after validating, call canCreateDeal; on
       deny return 402 with { error, code, upgrade: true, currentTier, limit }.
       Count is a cheap COUNT(*) under the workspace.
    7. Update /api/ai-analysis POST: after auth, call canRunAIAnalysis;
       on deny return 402 (same shape).
    8. webhook-dispatch.test.ts: feed each event type, assert patch.
       Includes the price.id → tier reverse mapping via mocked prices.
    9. gates.test.ts: PGlite harness, set a workspace's tier, attempt
       creates beyond the free limit, expect 402-shaped errors from the
       gate functions (the test exercises gate functions directly; route
       integration is covered by build + manual UAT).
  </action>
  <verify>
    - npm run build clean — new routes appear in output
    - npm test green (target +6 new tests)
    - Free-tier workspace can't create a 4th deal (gate returns ok=false)
    - canRunAIAnalysis returns false for free tier
    - Webhook dispatcher writes the right fields for each event type
    - All billing routes 503 cleanly when keys are absent
  </verify>
  <done>
    - 4 new billing routes committed
    - /api/deals + /api/ai-analysis enforce tier gates
    - Tests exercise dispatch + gate matrix
  </done>
</plan>
