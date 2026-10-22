# ROADMAP — CasaFlow

Phased delivery aligned to GSD's phase model. Each phase is one
`/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work` cycle.

---

## Phase 1 — Foundation & basic marketplace

**Goal:** A customer can sign up, post a job, see provider profiles,
and request a booking. A provider can sign up, create a profile, and
appear in search.

**Scope**
- Repo scaffold (Next.js frontend, FastAPI or NestJS backend,
  Postgres, Stripe-ready config), CI, linting, secrets handling.
- Auth: email/password + JWT, social login stub.
- Account types: `customer`, `provider`, `admin`.
- Customer profile + multi-address.
- Provider profile + service categories + service radius.
- Service category catalog (cleaning, handyman, plumbing,
  furniture assembly).
- Job request form (no photos yet).
- Provider search by category + city.
- Admin provider approval queue (manual approve / suspend).
- Health check, error monitoring, basic logging.

**Done when**
- A customer can submit a job request and see a list of pros.
- A provider can be approved and visible in search.
- Smoke test passes end-to-end on staging.

---

## Phase 2 — Quotes & matching

**Goal:** Customers receive quotes from multiple providers and can
compare them.

**Scope**
- Job media upload (photos / short videos to object storage).
- Quote submission API + UI for providers.
- Quote comparison screen for customers.
- Matching: send job request to top N providers by category +
  distance + rating + reliability.
- Quote lifecycle: submitted → accepted → rejected → expired →
  withdrawn.
- Accepting a quote creates a booking with the platform fee
  applied.

**Done when**
- A job request with photos generates ≥ 3 quotes from real test
  providers, and accepting one creates a booking.

---

## Phase 3 — Availability & scheduling

**Goal:** Provider calendars, instant booking, reschedule.

**Scope**
- Provider availability calendar (weekly grid + blocked time).
- Instant-booking flow (fixed-price service + open slot).
- Customer reschedule + cancel (with policy enforcement).
- Conflict detection on overlapping bookings.
- ETA updates: on-the-way → arrived → in-progress → completed.
- Booking reminders (email; SMS for emergency tier).

**Done when**
- Customer can pick a slot for a fixed-price service and the
  provider sees it on their calendar with no double-bookings.

---

## Phase 4 — Payments

**Goal:** Deposits, full payment, refunds, payouts.

**Scope**
- Stripe (Connect or equivalent) integration.
- 20% deposit on quote acceptance / booking confirmation.
- Final 80% capture on `completed`.
- Full-price capture for fixed-price instant bookings.
- Refund logic per policy tiers.
- Provider payout dashboard (gross, fees, net, pending).
- Invoices and receipts (PDF email).
- Platform fee = 15% included in quote total.

**Done when**
- A customer can pay a deposit, see it on their booking, and the
  provider receives the payout minus platform fee after completion.

---

## Phase 5 — Trust & reviews

**Goal:** Reviews, reliability, disputes.

**Scope**
- Review form (overall + 4 sub-ratings + comment), allowed only
  after `completed`.
- Provider rating recompute on each review.
- Reliability scores (customer + provider) with no-show /
  cancellation penalties.
- Verification badges driven by `verified_status`,
  `insurance_status`, `license_status`.
- Dispute workflow: customer opens → admin reviews evidence → ruling
  → refund / no-refund.
- Provider suspend / reinstate.
- License gating enforced for regulated categories (electrical,
  HVAC, plumbing).

**Done when**
- A completed booking can be reviewed once; a dispute can be opened,
  resolved, and triggers a partial or full refund.

---

## Phase 6 — Growth features

**Goal:** Recurring bookings, emergency dispatch, expanded
categories, Airbnb host bundles, multi-city groundwork.

**Scope**
- Recurring bookings (weekly cleaning, monthly maintenance).
- Emergency dispatch flow with surcharge and priority routing.
- Expand categories: moving, painting, appliance repair, locksmith,
  gardening, IT/internet support.
- Property profiles (recurring access notes, gate codes).
- Provider subscription tiers (Pro, Premium) and featured placement.
- WhatsApp Business notifications.
- City-aware feature flags so a second city can be added without
  redeploys.

**Done when**
- A host can set up weekly turnover cleaning across two properties,
  and an emergency lockout request routes to the nearest available
  pro within 5 minutes.

---

## Tracking

Phases are tracked in `STATE.md` (current phase + status) and
`CONTEXT.md` (decisions taken in the current phase). GSD writes both
automatically when commands are run.
