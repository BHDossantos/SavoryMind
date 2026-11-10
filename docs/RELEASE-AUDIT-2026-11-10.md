# Store/runtime release candidate refresh: 10 November 2026

Review branch only. No application merge, deployment, production migration,
provider charge, credential rotation, signed build, or store submission.

## Integration

PR #154's `7a5ea33deba25bf3cf3e99484cd5c5f636295c81` was reconciled with
main `a60c5ba757fe3120b8850ff8a7bdc6547b128eb2`.

- Retained verified Stripe customer, subscription and configured-price checks,
  retryable webhook failures, native entitlement separation, and cancellation
  state handling. Main's older-event guard is retained without restoring its
  optimistic entitlement fallback or metadata-based customer rebinding.
- The event watermark advances only for accepted updates, after identity and
  product verification. Rejected snapshots and deletion of an unrelated old
  subscription do not advance it. Regression tests cover these paths.
- Main added migration `a1d4f8c20b91` alongside the candidate's existing
  `a31d11e70001` branch. Both descend from `f1c3d7a92b60`. New no-op merge revision
  `a31d11e70007` joins `a1d4f8c20b91` and `a31d11e70006`, leaving existing
  migrations unchanged. A graph regression requires a single head.

## Release gates, in order

1. Restore and verify the canonical API, not just the provider URL. At the
   coordinating audit's 13:02 UTC check, the web root returned 200, custom API
   root and `/health` returned 503, and direct Render `/health` returned 200
   with database OK. That does not verify custom-domain application access.
2. Inspect live database engine, durable storage, backup/restore and runtime
   configuration through authorized hosting access. These are **unverified**,
   not proven failed. Render workspace confirmation remains pending; previous
   Vercel access was denied. Do not bypass either blocker. Preserve existing
   data before restart/cutover. This candidate rejects hosted SQLite, so it must
   not be blindly deployed into an unverified runtime.
3. Verify existing signing, social-login and token-encryption keys are supplied
   and stable. Their live configuration is unverified. Never generate a new
   encryption key for existing encrypted tokens as a deployment shortcut.
4. Review/apply migrations with a tested backup and rollback plan. Reconcile
   legitimate existing Stripe entitlements against the provider before rollout:
   legacy active status intentionally does not backfill verified provenance.
5. Configure and verify actual App Store/Play products, RevenueCat product maps,
   server key/webhook authorization and public platform SDK keys. Decide
   account-transfer/restore policy. Repository placeholders/configuration files
   are not proof that provider setup or signing access exists.
6. Build a new native binary for react-native-purchases. On isolated store
   sandbox accounts, verify purchase, renewal, refund, restore, cancellation,
   account switching, grace periods and offline recovery on both platforms.
   Do not introduce this native dependency through OTA alone.
7. Verify operational deletion support: mailbox delivery, queue owner, identity
   disputes, provider erasure, backup expiry and lawful retention. Follow the
   reviewed erasure workflow; intake acknowledgment is not completed deletion.
8. Produce signed Android/iOS device artifacts and validate native auth,
   notifications, permissions, media, billing and deletion end to end. Complete
   store listings, screenshots, privacy/data-safety declarations, review access,
   and any required agreements with the owner's participation. No current
   signed-device acceptance or store submission evidence was established.

## Validation scope

Tests use isolated local data and mocked billing providers. Migration validation
covers SQLite upgrade/downgrade/upgrade from each pre-existing head, plus a
populated main-head database whose `stripe_event_ts=2000` survives the candidate
SQLite table recreation while Stripe provenance defaults to `free`. PostgreSQL
DDL generation passed without a server connection; a hosted PostgreSQL migration
has not been performed. Full backend: 680 tests plus 16 subtests passed; the added migration-graph
regression passed separately (one test). Frontend: 96 tests / 14 suites passed,
plus production build. Mobile: 125 tests / 24 suites passed; both iOS and Android
Metro/Hermes exports passed. No dependencies or live credentials were changed. Metro/Hermes exports are JavaScript bundles, not
native compilation, signed binaries, device acceptance or store approval.
