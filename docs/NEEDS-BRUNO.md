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

## Go-live checks (only you can do)
- [ ] Post-deploy: `curl -s https://savorymind.net | grep -i "<h1"`, one authed
  hit to `/api/restaurant/health-score`, then `docs/SEO_OPERATIONS.md`
  (Search Console / Bing submission).

_Updated by the autonomous growth loop as new you-only items surface._
