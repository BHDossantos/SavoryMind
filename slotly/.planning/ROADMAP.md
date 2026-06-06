# Slotly — Roadmap

Phases shipped to date are reconstructed from the existing git history. v2 phases are forward-looking placeholders, in priority order.

## Phase 01 — End-to-end booking loop (v0 scaffold)

**Status:** done
**Goal:** Make the smallest end-to-end loop work: signup → provider profile + services + availability → customer search → book → cancel.
**Requirements:** REQ-001..005, REQ-010..013, REQ-020..028
**Commit:** `e926bfc feat(availablenow): scaffold real-time appointment booking platform`
**Summary:** `phases/01-SUMMARY.md`

## Phase 02 — Reviews & ratings

**Status:** done
**Goal:** Close the journey loop: book → attend → rate → rebook. Reviews populate the trust signals that make the search results believable.
**Requirements:** REQ-030..035
**Commit:** `170e5f3 feat(availablenow): reviews + ratings`
**Summary:** `phases/02-SUMMARY.md`

## Phase 03 — Stripe deposits

**Status:** done
**Goal:** Address the no-show problem from the spec by making providers able to require a deposit. Includes Stripe Checkout, refunds, pending-payment TTL, and a stub mode for keyless dev/CI.
**Requirements:** REQ-040..046, plus REQ-012 update to add deposit fields on Service
**Commit:** `6e3dc3a feat(availablenow): Stripe deposits with stub-mode dev fallback`
**Summary:** `phases/03-SUMMARY.md`

## Phase 04 — Admin panel + provider approval

**Status:** done
**Goal:** Real providers can self-signup but stay invisible until an admin reviews them. Admins also get a marketplace dashboard, bookings + users tables, and a suspend lever.
**Requirements:** REQ-050..057, plus REQ-014 + REQ-022 (search + profile filtering)
**Commit:** `091ac33 feat(availablenow): admin panel + provider approval workflow`
**Summary:** `phases/04-SUMMARY.md`

## Phase 05 — Email notifications + reminders

**Status:** done
**Goal:** The other half of the no-show fix from the spec, alongside deposits. Lifecycle events (book / pay / cancel) auto-enqueue confirmation + 24h + 2h + cancellation emails. APScheduler drains the queue.
**Requirements:** REQ-060..067
**Commit:** `a9cfed3 feat(availablenow): email notifications + reminders (24h + 2h)`
**Summary:** `phases/05-SUMMARY.md`

## Phase 06 — Slotly rebrand + GSD adoption (this phase)

**Status:** in_progress
**Goal:** Rename project AvailableNow → Slotly, adopt the GSD planning workflow, and prepare a clean migration to the `BHDossantos/Slotly` GitHub repo.
**Requirements:** none — meta-phase.
**Commits:** `834821a chore(slotly): rename availablenow -> slotly` + `96513b3 chore(slotly): update brand strings to Slotly` + this commit (`docs(slotly): GSD planning + migration kit`).
**Summary:** `phases/06-SUMMARY.md`

---

## v2 — Planned (priority order)

### Phase 07 — Auto-fill cancellations

**Status:** done
**Goal:** When a confirmed appointment is cancelled, broadcast the freed slot to customers who searched the same category recently. The spec's "killer feature" tied to the brand promise.
**Requirements:** REQ-100..102
**Dependencies:** Phase 05 (notification infra) ✅, Phase 03 (refund logic) ✅
**Summary:** [`phases/07-SUMMARY.md`](phases/07-SUMMARY.md)

### Phase 08 — Real geosearch

**Status:** planned
**Goal:** Replace today's city-string match with lat/lng + radius. Map view on search results.
**Requirements:** REQ-110..112
**Dependencies:** Google Places API key.
**Risks:** Cost (Places autocomplete is metered); fall back to a free geocoder if needed.

### Phase 09 — Disputes / refund workflow

**Status:** planned
**Goal:** First-class disputes that escape the manual "suspend the provider" lever the admin tab gives today.
**Requirements:** REQ-120..122
**Dependencies:** Stripe partial-refund flow.

### Phase 10 — Promotions

**Status:** planned
**Goal:** Featured placement + discount codes + last-minute offers.
**Requirements:** REQ-130..132

### Phase 11 — Multi-channel reminders

**Status:** planned
**Goal:** SMS via Twilio, WhatsApp via WhatsApp Business API, push via PWA.
**Requirements:** REQ-140..142
**Risks:** WhatsApp Business API onboarding is the slow path; SMS first.

### Phase 12 — Provider analytics

**Status:** planned
**Goal:** Provider dashboard with utilisation %, top services, cancellation rate, revenue trend.
**Requirements:** REQ-150
