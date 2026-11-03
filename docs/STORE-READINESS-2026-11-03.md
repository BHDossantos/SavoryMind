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
