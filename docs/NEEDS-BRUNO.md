# Needs Bruno — deferred to last

Per Bruno's direction ("forget about the API for now", "whatever it needs me,
leave it for last"), the autonomous growth loop does NOT block on any of these.
They're queued here so nothing is lost. Everything else — all no-credential
product + monetization work — ships first on the working branch as draft PRs.

## Revenue switches (each unlocks money directly)
- [ ] **Stripe Price IDs** — create the 3 restaurant Products/Prices
  (Trattoria €149 / Ristorante €299 / Gruppo €599) + the consumer Premium
  price (€9,99). Hand me the Price IDs → billing tiers go live. The
  guarantee-blocks-auto-conversion logic + entitlements are already built.
- [ ] **Merge PR #105** (and successors) when reviewed → fixes/features deploy.

## Dormant features waiting on a credential (code is built, no-op until set)
- [ ] **WhatsApp (Meta Cloud API token + number)** → coaching delivery goes live.
- [ ] **Google Reviews API** → real review ingestion + review→staffing insight.
- [ ] **Weather / holidays / tourism feeds** → richer Digital Twin forecasts.
- [ ] **Delivery platforms (Uber Eats / DoorDash)** → real consumer delivery.

## App Store & Google Play submission (full runbook: docs/STORE_SUBMISSION.md)
Build config + store-listing copy are ready; these need your accounts/credentials:
- [ ] **Apple Developer Program** ($99/yr) + **App Store Connect API key** (`.p8` → `mobile/asc-api-key.p8`, plus `ASC_API_KEY_ID` / `ASC_API_ISSUER_ID`). iOS app record already exists (ascAppId 6769830917).
- [ ] **Google Play Console** ($25 one-time) + **service-account JSON** (→ `mobile/play-service-account.json`).
- [ ] Run `eas build` + `eas submit` (needs your Apple/Google/Expo logins + 2FA), then click "Submit for review" in each console.
- [ ] Create a **demo review account** (`review@savorymind.net`) so store reviewers can pass the login gate.
- [ ] (Recommended) Replace the placeholder icon/splash/adaptive-icon — currently one reused image (see runbook §"asset to improve").

## Go-live checks (only you can do)
- [ ] Post-deploy: `curl -s https://savorymind.net | grep -i "<h1"`, one authed
  hit to `/api/restaurant/health-score`, then `docs/SEO_OPERATIONS.md`
  (Search Console / Bing submission).

_Updated by the autonomous growth loop as new you-only items surface._
