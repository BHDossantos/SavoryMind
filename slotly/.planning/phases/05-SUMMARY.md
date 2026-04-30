# Phase 05 — Email notifications + reminders

**Status:** done
**Commit:** `a9cfed3`
**Date:** 2026-04-30

## Goal

The other half of the no-show fix from the spec, alongside Stripe deposits. Booking lifecycle events automatically enqueue transactional emails and an in-process scheduler delivers them on time.

## Outcome

- `Notification` model: per-user, per-channel, with `scheduled_at`, `status` (`pending` / `sent` / `failed` / `cancelled`), `kind` (`booking_confirmed`, `reminder_24h`, `reminder_2h`, `booking_cancelled`), and `provider_message_id` for traceability.
- `email_client.py` wraps Resend with **stub mode**: no `RESEND_API_KEY` → notifications still get persisted but no real email leaves the process.
- `notifications_service.enqueue_for_appointment` fans out confirmation + 24h + 2h reminders. Idempotent (D-12); re-running for the same appointment is a no-op.
- `enqueue_cancellation` marks pending reminders as `cancelled` and enqueues a cancellation email immediately.
- `process_due()` pulls notifications where `scheduled_at <= now` and sends them; failures are recorded on the row, not retried (yet).
- Booking flow integration:
  - No-deposit booking → notifications enqueued at booking time
  - Deposit booking → enqueued **only after** payment is confirmed (D-13). Avoids spamming customers whose deposit never lands.
  - Cancellation → remaining reminders cancelled, cancellation email enqueued
- APScheduler `BackgroundScheduler` runs `process_due` every `NOTIFICATIONS_TICK_SECONDS` (default 60) starting at app startup (D-11).
- Admin endpoints (admin role only):
  - `GET /admin/notifications` with status + kind filters
  - `POST /admin/notifications/run` to manually drain the queue
- Frontend: new `/admin/notifications` tab with status + kind filters, status pill, and a "Run scheduler now" button for fast iteration during dev.

## Decisions logged

- D-11 (APScheduler in-process), D-12 (idempotent enqueue), D-13 (deposit gating)

## Verified (8 scenarios)

No-deposit booking enqueues all 3 notifications → manual run sends only the due one → backdating 24h reminder makes it due → cancel marks pending reminder cancelled + enqueues cancellation email → deposit booking only enqueues after payment is confirmed → filters work → non-admin gets 403.

## What was deferred

Retries on failed notifications, exponential backoff, dead-letter handling, SMS / WhatsApp channels, push notifications, user notification preferences (opt-out), email click + open tracking.
