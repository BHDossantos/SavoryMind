# Store/runtime integration candidate — 7 November 2026

Review candidate only. No main-branch merge, deployment, billing-provider call,
signing, store submission, production migration or paid
action was performed.

## Inputs and resolved conflicts

- Runtime/Stripe identity PR #153: `b2cf73c5bef38449df9a9f333e4299dd4ae8ad7c`.
- Native billing/deletion PR #151: `880969006a446199ff2d1ce5982f44e805830ef5`.
- Common ancestor: `346bb6910d8bb9df525ff52bc8d550de7d44bc73`.

The two billing handler conflicts retain #153's provider retrieval, configured
price and customer identity validation. They do not restore #151's optimistic
paid grant when retrieval fails. Native billing, cancellation-only management,
account deletion/erasure and runtime startup guards are retained.

## Integration bugs fixed

The consolidated Stripe snapshot helper now updates cancellation-at-period-end
state. Four new cases failed before this fix: setting and clearing that state
through checkout completion and subscription-update events. An invalid customer
snapshot cannot change cancellation state.

Native fallback previously treated any active Stripe subscription as paid
access, even after #153 rejected its unknown price. A combined regression
reproduced an invalid grant after native membership expired. A separate
`stripe_verified_plan` column now records only the configured-price-verified
Stripe result. Native fallback requires that result, active/trialing status,
and an unexpired period. Stripe cancellation clears its own verified entitlement
while preserving independently active native access. Provider calls are mocked
in all regression tests.

The full-suite run also exposed real PostHog SDK initialization in analytics
tests that set dummy keys before registering users. A suite-wide fixture now
replaces the SDK constructor with an in-memory mock and clears cached clients.
Wrapper tests still inspect event calls; no analytics sender thread is started.

## Explicit application keys

Configuration no longer embeds signing, social-login or token-encryption
defaults. SECRET_KEY, SOCIAL_LOGIN_SECRET and TOKEN_ENCRYPTION_KEY must be
explicitly supplied in every environment; blank values fail configuration.
Production still rejects known legacy unsafe defaults. Tests generate fresh
session-only keys in memory and do not read real developer credentials.

For local development, supply private values through an uncommitted environment
file or your normal local secret store. Keep existing encryption keys stable;
do not regenerate them for a database containing encrypted provider tokens.
For a new empty local environment, generate fresh signing secrets and a Fernet
key locally, then preserve them privately between restarts. No key file is
created or credential rotated by this change. Existing development data needs
an explicit key/migration decision before switching away from a legacy key.

## New migration and rollout hold

Migration `a31d11e70006` follows #151's `a31d11e70005` and defaults existing
Stripe provenance to `free`; status/combined plan must not be used to backfill
it. Before rollout, reconcile existing independently paid Stripe subscriptions
against the provider in an approved operational workflow. Otherwise native
expiry can intentionally fail closed instead of retaining an unverifiable
legacy Stripe entitlement. This candidate does not run that reconciliation.

Preserve and reconcile existing hosted SQLite data before any restart or
database cutover. The runtime guard intentionally rejects hosted SQLite. Verify
durable PostgreSQL, existing signing/encryption configuration, migration order,
backup/rollback and canonical API health before considering deployment.

Store/native validation, provider configuration, real-device acceptance and
account-transfer policy remain required. A new binary is required for
react-native-purchases; do not introduce it solely through an OTA update.

## Validation

Final integrated local backend: **679 passed, 16 subtests passed** (14,079
existing/dependency deprecation warnings). Mobile: **125 tests / 24 suites**.
Frontend: **96 tests / 14 suites**, plus production Next build. Both iOS and
Android Metro/Hermes exports passed. Final diff whitespace checks passed.
SQLite migration upgrade/downgrade/upgrade passed; a seeded legacy active
Stripe row retained unverified/free provenance as intended. PostgreSQL DDL
generation for the new migration passed without connecting to a server.

Native JS exports are
not Xcode/Gradle compilation, signed binaries or store approval. SQLite
migration execution and PostgreSQL SQL generation do not establish a hosted
PostgreSQL migration pass. Hosted CI must run on the published exact head if
this candidate is later approved for publication.
