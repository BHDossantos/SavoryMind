# Billing and deletion follow-up — 3 November 2026

Draft PR #151 only. No production settings, credentials, migrations, builds, releases or deployments were changed. Render work is deferred at the owner's request.

## Implemented

- Native subscription purchase/restore uses RevenueCat and an opaque server-issued account UUID. The backend fetches its authenticated customer record, accepts configured products and verified store transactions only, checks ownership/expiry/refunds, and updates entitlements. Google order IDs are never treated as purchase tokens. Provider outages are retryable; after a charge the app tells the user to restore instead of buy again. Authenticated access expires at the verified term end; authenticated webhooks reconcile renewals/refunds.
- Store prices and billing periods come from the native SDK. Existing Stripe or native subscribers are not offered a second subscription. Store subscriptions link to native store management. Existing Stripe subscribers have a cancellation-only authenticated endpoint with customer ownership checks and provider-confirmed cancellation; no external checkout is reopened.
- Signed-in deletion requests are durable and tied to the authenticated account. Public intake requires a one-time, expiring email token; opening the page does not confirm it. Email outages do not discard requests. Neither UI promises a processing deadline nor confuses acknowledgment with erasure.
- The operator queue supports review, retention holds and completion evidence. Completion refuses to proceed while the account/directly linked records remain and requires database, provider, backup and retention evidence. It then removes queue identity data. This is NOT an automatic erasure implementation: indirect data and external providers require a reviewed operator plan.

## Owner/release prerequisites

1. Apply both new migrations in a reviewed release, before serving new API code. They were tested locally only.
2. Configure actual App Store/Play subscription products in RevenueCat. Set backend `REVENUECAT_PRODUCTS` to a JSON object mapping actual SKUs to `premium` (consumer/diner) or `pro` (restaurant), `REVENUECAT_SECRET_API_KEY`, and an exact `REVENUECAT_WEBHOOK_AUTHORIZATION`. Register `/api/billing/store/webhook` with that Authorization value. Do not put the secret key in mobile.
3. Set mobile public `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`; build a new native binary with react-native-purchases. This dependency cannot be introduced through an OTA update to an old binary. Production rejects sandbox purchases; local SQLite tests may explicitly set `REVENUECAT_ALLOW_SANDBOX=true`. Use an isolated test environment for store acceptance tests.
4. Decide and test RevenueCat account-transfer/restore policy. Receipt ownership conflicts fail safely and require support; no automatic cross-account transfer is implemented. Test real sandbox purchase, renewal, refund, restore, account switching, cancellation, offline recovery and grace periods on both platforms.
5. Verify support/privacy mailbox operation, daily queue ownership, identity disputes, external-provider erasure, backup expiry and lawful retention scope. Do not mark a request complete merely because it was emailed. `python scripts/deletion_queue.py --help` describes the operator tool; never run mutations without a reviewed erasure/retention plan.
6. API hostname reachability, signed builds, store metadata/privacy declarations and device acceptance remain unverified. No previously denied service access was retried. Existing #150 remains separately reviewable.

## Validation

- Full backend: 609 passed (existing deprecation warnings remain).
- Mobile: 118 tests / 24 suites passed (`--runInBand --testTimeout=30000`; an earlier run hit the existing AuthContext 5-second timeout during concurrent test load).
- Frontend: 91 tests / 14 suites passed, including fragment-token confirmation and verification failures.
- Both new migrations upgraded, downgraded to f1c3d7a92b60 and upgraded again on isolated SQLite.
- Local iOS and Android Metro exports passed. An initial all-platform export requested unconfigured web dependencies; native-only export passed without adding web dependencies.
- `git diff --check` passed.

Tests use isolated local databases and mocked provider responses, not live charges or production records. Native Metro export checks JS bundling only, not signing or store readiness.

## Independent review follow-up

- Webhook identity lookup now considers `original_app_user_id` and `aliases`, in addition to current/transfer IDs, following RevenueCat's [identity fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields#subscriber-identity-fields). Only existing opaque membership identities are fetched; no alias mapping or new account is created from the event.
- Native SDK identity changes are serialized with the entire purchase/restore operation. Verification uses the original access token, refuses changed sessions and does not refresh into another account. The screen discards completion after an account switch/unmount. A purchase interrupted by a switch is recoverable by signing back into the original account and restoring; never buy again to recover it.
- Reconciliation refreshes/locks membership state after acquiring the user lock, so a stale unlinked snapshot cannot hide a concurrently committed first grant from a refund. The regression uses two interleaved database sessions.
- The deletion operator list defaults to verified actionable requests. `--after` (the returned `next_cursor`) and `--limit` expose subsequent pages without skipping requests when earlier pages are completed; `--include-unverified` is an explicit separate triage view. A regression with 120 older unverified and 105 verified requests confirms actionable work is not hidden. The output contains request IDs/status, not email/reason/token data.

Provider account-transfer policy, real device purchase/restore acceptance and external erasure/retention operations remain release gates. No production operation was performed.

Review validation: full backend **616 passed**; full mobile **122 tests / 24 suites passed**; final API transport subset **18 passed**. The targeted backend review suite passed 29 tests before the final full run. Existing deprecation warnings remain.

Pagination review: listing now uses a `(created_at, id)` cursor rather than an offset over a changing result set. The 105-request regression completes the first 100 before using `next_cursor` and receives exactly the remaining five, including a shared timestamp tie-breaker. Full deletion regression suite: 12 passed. Cursors contain only the ordering timestamp and request ID, never email, verification tokens or reasons.

A reviewed, durable local private-account erasure workflow is now available in [ACCOUNT-ERASURE-OPERATIONS.md](ACCOUNT-ERASURE-OPERATIONS.md). It blocks shared/unknown records and legal holds, requires an unchanged reviewed row-set hash plus provider/backup/retention evidence references, and preserves a separate database-erased state until completion is independently verified. Native purchases now refresh server eligibility, product membership and account identity immediately before invoking the store SDK, preventing a stale free screen from charging an already-subscribed account.

Erasure/provider-flow validation: full backend regression run **622 passed**, followed by **19 final erasure/deletion tests** covering committed concurrent holds and active-billing review guards. Full mobile **125 tests / 24 suites passed**. The new erasure-run migration passed isolated upgrade/downgrade/upgrade. No live erasure or provider call was performed.
