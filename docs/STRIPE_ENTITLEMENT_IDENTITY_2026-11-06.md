# Stripe entitlement identity candidate — 6 November 2026

Base: integrated candidate `5b178445`, isolated branch `fix/stripe-entitlement-identity-20261106`. Draft PR151's separate cancellation-field work is untouched. No production configuration, deployment, publication, credentials or financial mutations were performed.

## Changes

- A stored Stripe customer binding is mandatory. Checkout metadata/client reference can cross-check that identity, but cannot claim an unbound account, replace an existing customer, or silently contradict one another. Duplicate local customer matches fail rather than choosing an arbitrary user.
- Checkout completion and subscription created/updated handlers retrieve the subscription and verify its ID and customer against the event and local binding. An event's signed but historical `active` status is no longer sufficient to grant access.
- Entitlement requires exactly one subscription item, quantity one, and the exact configured price for the account's current type. Restaurants paying the consumer price—including accounts converted after subscription purchase—cannot gain Pro. A tracked historical subscription with a mismatched price loses its incorrectly granted paid plan on the next applicable delivery. An unrelated unsupported subscription cannot revoke a separately tracked subscription.
- Missing or incomplete provider data, mismatched identity, missing product configuration and a shared consumer/restaurant price produce a retryable503 without committing state. A verified subscription on an unsupported price/shape receives no paid entitlement. Unsupported billing records require reconciliation; no extra checkout or financial action is automatically initiated.
- Expanded customer references and both top-level and single-item billing period ends are supported. Stripe documents subscription-item `current_period_end`: https://docs.stripe.com/api/subscription_items/object. Current snapshot retrieval follows the guidance at https://docs.stripe.com/webhooks.

## Verification

Final focused command, run with the existing isolated Python test environment:

`python -m pytest tests/test_billing.py tests/test_billing_delivery.py tests/test_restaurant_billing.py tests/test_billing_identity.py -q`

**42 passed**, 703 existing/dependency deprecation warnings. Fixtures now contain actual subscription IDs, customers and item/price structures. Regression tests include historical restaurant/consumer-price mismatch, unknown/multi-item/zero-quantity products, customer/subscription mismatch, metadata conflicts, missing bindings, ambiguous configuration, stale active events with current canceled snapshots, and item-level period ends. Signature verification is exercised locally; provider reads are mocked and an explicit SDK retrieval guard prevents unmocked access in these modules. `git diff --check` passed. The parent previously ran599 tests on the integrated pre-change baseline; this candidate has the focused42-test run, not a new full-suite result.

An initial fixture-edit command failed due to its working directory, but the subsequent test command still ran with old sparse fixtures. The restaurant lifecycle test consequently reached `Subscription.retrieve("sub_rest_1")` (the SDK read for `GET /v1/subscriptions/sub_rest_1`) with a hardcoded dummy test key and returned503. No successful provider operation was observed and no financial write was requested. The final tests run after explicit retrieval mocks and SDK guards were installed.

## Still open

- Historical unbound customers need verified reconciliation; metadata alone no longer repairs their binding. Existing incorrect paid flags are not bulk-rewritten; they are corrected only by applicable verified events or a reviewed repair process.
- Checkout reservations/idempotency are still needed to serialize simultaneous checkouts and avoid duplicate subscriptions.
- Provider retrieval reduces stale-event risk but does not serialize concurrent snapshots/commits. Durable event recording, stale-event reconciliation and complete multi-subscription selection remain open. The existing matching-ID deletion guard is preserved, not redesigned.
- No hosted Stripe acceptance, production database audit, full replacement-subscription design or migration was performed. This is a bounded identity/product validation improvement, not a claim of complete billing safety.
