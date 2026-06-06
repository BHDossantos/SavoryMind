# Phase 07 — Auto-fill cancellations

**Status:** done
**Date:** 2026-06-05

## Goal

When a confirmed appointment is cancelled, broadcast the freed slot to customers who searched the same category recently. The killer "Available Now" differentiator from the spec.

## Outcome

### Backend changes (surgical layer on top of the existing Slotly)

- **`SearchLog` model** in `models.py` — `(user_id, category, city, neighborhood, created_at)` with indexes on `user_id`, `category`, `city`, `created_at`. One row per authenticated customer search.
- **`NotificationKind.auto_fill_slot`** — new kind alongside the lifecycle kinds. `Notification` also gains an optional `provider_id` so auto-fill rows (which have no `appointment_id` — the freed slot isn't the recipient's appointment) still point at the provider for admin auditing.
- **`security.get_current_user_optional`** — returns `Optional[User]`. Doesn't raise on missing/invalid bearer. Used by `/search/providers` so it can stay public *and* log when the caller happens to be authenticated.
- **`search.py`** writes a `SearchLog` row for authenticated customer searches with non-empty `category` + `city`. Anonymous and non-customer searches are silently skipped (no log → no broadcasts).
- **`notifications_service.enqueue_auto_fill(session, cancelled_appointment_id)`** orchestrates the broadcast:
  1. Pull the cancelled appointment + provider + service.
  2. Skip if `start_at <= now()` (no point — the slot is gone).
  3. Find distinct user_ids who searched `(provider.category, provider.city)` in the last `AUTO_FILL_LOOKBACK_DAYS` (default 14), ordered most-recent-search-first.
  4. Exclude the canceller (`appt.customer_id`).
  5. Per recipient: skip if they got an `auto_fill_slot` notification in the last `AUTO_FILL_USER_RATE_LIMIT_HOURS` (default 24).
  6. Cap at `AUTO_FILL_MAX_RECIPIENTS` (default 20).
  7. Enqueue an immediate notification. APScheduler tick (or `/admin/notifications/run`) sends them.
- **`appointments.cancel_appointment`** calls `enqueue_auto_fill(...)` right after the existing `enqueue_cancellation(...)`, inside the same DB transaction.

### Configuration

Three new env vars surfaced in `.env.example`:
- `AUTO_FILL_LOOKBACK_DAYS=14`
- `AUTO_FILL_MAX_RECIPIENTS=20`
- `AUTO_FILL_USER_RATE_LIMIT_HOURS=24`

### Email content

Subject: `Just opened · {service} at {provider}`
Body: name, neighborhood, when, `"you searched for {category} recently — book before someone else grabs it"`. CTA: open Slotly and tap the provider.

## Decisions logged

- D-14 anonymous searches not logged
- D-15 match key is `(category, city)` for now — neighborhood-level deferred to geosearch phase
- D-16 24h per-user rate limit
- D-17 20 recipient cap, ordered by recency
- D-18 past-slot cancellations don't broadcast

## Verified — 8 scenarios

1. Alice + Bob log barber-Rome searches. Carol logs nails-Rome. Dan + anonymous searches are not logged.
2. Dan books a barber appointment at Marco's.
3. Dan cancels → 2 `auto_fill_slot` notifications: Alice + Bob. Carol excluded (wrong category). Dan excluded (canceller). Anonymous excluded (no log).
4. Subject + status look right (`Just opened · Men's haircut at Marco's Barber Shop`, status `pending`).
5. Manual scheduler run sends them (`POST /admin/notifications/run`).
6. Second barber cancellation within 24h → no new notifications for Alice/Bob (rate limit holds).
7. Cancellation of a past-dated appointment → no broadcast.
8. With 25 candidates having matching searches, the broadcast caps at exactly 20.

All checks passed end-to-end against the full-featured Slotly backend (38 routes; Stripe deposits, reviews, admin panel all still working).

## Caveats / known limitations

- `SearchLog` grows unbounded. Old rows are harmless to correctness (the query filters on `created_at >= cutoff`), only disk usage grows. Add a retention sweep when volumes warrant.
- No unsubscribe / "stop auto-fill alerts" user preference yet. Admin can purge from the DB manually.
- Email is the only channel. SMS/WhatsApp/push are still on the roadmap (Phase 11).
- Match precision is coarse — `(category, city)`. Once geosearch lands, we should narrow to neighborhood + radius so an EUR customer doesn't get notified about a Trastevere slot they'll never travel to.

## What's next

Phase 11 — Provider flash-promote slot: a manual variant of this same broadcast where the provider creates an open slot (rather than cancellation creating one) and optionally attaches a discount. The infra from Phase 07 (recent-searchers query, rate limit, recipient cap) is directly reusable.
