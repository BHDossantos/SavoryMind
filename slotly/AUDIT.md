# Slotly audit — 2026-11-11

## Scope and result

Audited the existing `slotly/` application on
`claude/appointment-booking-platform-FYizt`, starting at
`f00f8ea388b32d56c12ee0700db69f322f5216de`.
This is a safer demo candidate, not a production or app-store release.
No live integration, deployment, merge, or standalone repository migration occurred.

## Repaired

- Public signup can no longer request administrator privileges.
- Unsigned demo webhooks are disabled; customer-owned stub confirmation is the only demo payment entry point.
- Cancelled, refunded and expired bookings cannot be changed to paid by late confirmation. Completed callbacks require paid status plus matching checkout ID, amount and currency. Duplicate paid callbacks remain idempotent.
- Booking and direct service lookup require an approved provider. Booking no longer walks default-city search results to find a service, so cross-city deep links work.
- Invalid service duration, negative amounts and deposits exceeding price are rejected. Offset-aware booking input is normalized to UTC.
- Explicit `INTEGRATIONS_MODE=stub` defaults to no Stripe/Resend traffic even if keys exist. Production rejects stub mode, weak default JWT configuration and non-HTTPS frontend; live mode requires all integration credentials. Demo seed refuses production/live mode.
- Login return URLs cannot be JavaScript or external/protocol-relative destinations; payment return preserves query parameters through login. Unverified Stripe redirects show processing rather than confirmed.
- Navigation wraps on narrow screens; client route params migrated for Next 15.
- Next upgraded from 14.2.15 to 15.5.29. PostCSS upgraded and overridden consistently, vulnerable transitive packages refreshed, lockfile retained.
- Root Slotly CI now builds and typechecks the frontend in addition to backend tests.

## Verification

- Backend: 56 tests passed, isolated in-memory SQLite; integrations forced to stub.
- Frontend: `npm run build` passed on Next 15.5.29 (18 routes).
- Frontend: `npm run typecheck` passed.
- `npm audit`: 0 known vulnerabilities in the final installed dependency tree.
- `git diff --check`: passed.
- No configured standalone ESLint ruleset; build/type checks are not a substitute for a lint audit.
- No interactive browser, device, native-app or accessibility audit performed. Navigation responsiveness change is code-reviewed only.
- Backend dependency advisory scan, load tests and real webhook signatures/provider settlement were not tested.

## Release blockers and follow-up work

1. Add DB-enforced concurrent booking exclusion/transaction strategy and concurrency tests. Existing sequential conflict checking is not sufficient across workers.
2. Implement and test late Stripe settlement reconciliation/refund, checkout expiry and durable webhook idempotency. Rejecting stale payment confirmation protects slot integrity but does not reconcile money already captured externally.
3. Review backend dependency advisories and upgrade supported versions; add auth throttling, stronger password policy, recovery/verification and hardened token storage/session revocation.
4. Replace the per-process notification scheduler with durable queue/locking for multi-worker delivery, with consent and opt-out handling before real auto-fill outreach.
5. Define provider-local timezone/DST semantics and explicit UTC response serialization; current persisted timestamps remain naive UTC.
6. Run real mobile-browser accessibility, interrupted login/checkout, back navigation and repeated-action tests. Slotly itself has no native app build, app-store signing or release artifacts.
7. Review production infrastructure, migrations/backups and operations separately. No launch or deployment was authorized or attempted.
