# FitNow: interactive local demo foundation

This new, isolated prototype implements the first discovery → sample reservation → cancellation loop from `fitnow-transfer/docs/PRODUCT_BRIEF.md`. Existing planning documents are unchanged. It is not a completed MVP, production service or signed mobile application.

## Run and test

Requires Node22 or newer. Run from `fitnow-transfer/demo`:

```sh
npm ci
npm test
npm start
```

Open http://127.0.0.1:4173. Server binds loopback only. For browser tests:

```sh
npx playwright install --with-deps chromium webkit
npm run test:browser
```

## Implemented

- Responsive mobile-first English/Italian discovery and category filters.
- Explicitly fictional sample listings and prices; Rome-localized example times.
- Integer-cent price breakdown and deterministic reservation model.
- Capacity, approval, licensing, duplicate, overlap and expired-slot guards.
- Cancellation restores sample capacity; sample quote requests for CasaFlow.
- Accessible controls and live status feedback. In-memory state resets on reload.
- Web app manifest and icon; no offline cache or native wrapper is claimed.
- 12 domain regression tests and 12 browser scenarios across desktop Chromium, Android Chromium and iPhone WebKit.

No real user details, authentication, card data, provider contacts or health records are collected. No request creates an actual booking or payment. The server serves only allowlisted static files, rejects writes and sends a restrictive CSP.

## Not implemented / release gates

- Real accounts, server-side authorization and secure sessions.
- Durable multi-user database, atomic slot locking and timezone/DST-safe provider schedules.
- Actual provider onboarding/verification, profiles, availability management and administrative controls.
- Real payments, provider payouts, webhook reconciliation, refunds and disputes.
- Notifications, location search, production hosting and operational monitoring.
- Privacy/data retention/account deletion, terms and cancellation policy approval.
- Signed native iOS/Android builds, device acceptance and store metadata/submission.

The existing briefs specify PWA-first development and native mobile later. This prototype progresses that first phase but does not implement the complete business workflow. No original repo migration was performed; changes remain scoped to this directory and its test workflow, based on `claude/fitness-platform-naming-f46v0` rather than SavoryMind main.

For CasaFlow, the brief's 20% deposit/15% included platform fee is illustrated only, not charged. Plumbing remains unbookable without verification. For FitNow, deposit/cancellation amounts are not invented. Synthetic approval fields are demo fixtures, never claims about real businesses.
