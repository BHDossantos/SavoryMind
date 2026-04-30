# Phase 02 — Reviews & ratings

**Status:** done
**Commit:** `170e5f3`
**Date:** 2026-04-29

## Goal

Close the customer journey loop (book → attend → rate → rebook) and populate the trust signals (★ rating + count) that make search results believable.

## Outcome

- New `Review` model with unique constraint per appointment
- `POST /reviews` — customer-only, only after `start_at`, marks the appointment `completed` if it was still `confirmed`, rejects duplicates with 409
- `GET /providers/{id}/reviews` — public review list with customer first name + service name
- `GET /appointments/{id}/review` — visible to the customer or provider
- AppointmentOut now exposes `has_review` / `can_review` so the UI can decide what to render
- Provider rating + count update **additively** (D-05) so seeded demo numbers survive the first real review
- Frontend: review page with star picker, "Leave a review" button on past appointments, "Reviewed" badge once submitted, reviews section on provider profile, reusable `<Stars/>` component
- Cancel button only shown for future-confirmed appointments

## Decisions logged

- D-05 (additive rating update over recompute)

## Verified

book → backdate `start_at` → 5★ review → duplicate=409 → stranger=403 → future-appt=400 → provider stars + count incremented → appointment auto-flipped to `completed`.

## What was deferred

Admin review moderation, provider responses to reviews, photos in reviews.
