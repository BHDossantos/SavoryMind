# Phase 03 — Stripe deposits

**Status:** done
**Commit:** `6e3dc3a`
**Date:** 2026-04-29

## Goal

Address the no-show problem (the biggest revenue drag from the spec). Providers can require a deposit per service; customers pay via Stripe Checkout; deposits follow a refund policy on cancellation.

## Outcome

- `Payment` model + deposit fields on `Service` (`deposit_required`, `deposit_amount_cents`)
- `payment_status` on `Appointment` (`not_required` / `pending` / `paid` / `refunded` / `failed`)
- Stripe Checkout integration via `payments_client.py` wrapper
- **Stub mode** (D-07): when `STRIPE_SECRET_KEY` is unset, the wrapper returns a Checkout URL pointing back at `/booking/success?stub=1` and refunds are recorded locally only. Same dev-friendly pattern we'll re-use for Resend.
- `POST /appointments` returns a `BookingOut` (appointment + checkout_url + payment_id). No-deposit services keep the legacy pay-at-venue path.
- `POST /payments/stub-confirm/:id` — stub-mode endpoint; real Stripe deployments use the webhook below.
- `POST /payments/webhook` — verified webhook that flips payment + appointment to `paid` on `checkout.session.completed`.
- Cancellation refund rule (D-09):
  - Customer cancels >2h before start → refund.
  - Provider cancels at any time → refund.
  - Customer cancels ≤2h before → deposit forfeit.
- **Pending-payment TTL** (D-08, default 15 min): abandoned-checkout slots get released back into availability automatically via the slot engine.
- Seed: Parioli Grooming has two deposit-required services so the flow is exercisable on first run.
- Frontend: booking page surfaces "X EUR deposit required"; redirects to checkout URL; `/booking/success` handles the post-checkout redirect (stub mode calls `stub-confirm`); provider services UI exposes a "Require deposit" toggle + amount; appointments list shows the deposit + payment_status badge.

## Decisions logged

- D-06 (Checkout over Elements), D-07 (stub mode), D-08 (15-min pending TTL), D-09 (refund policy)

## Verified (8 scenarios)

1. No-deposit booking unchanged
2. Deposit booking holds slot + returns checkout URL
3. Stub-confirm flips payment to paid
4. Far-future cancel → refund
5. Abandoned pending-payment slot released after TTL
6. Within-2h customer cancel → deposit forfeit
7. Provider cancel within 2h → still refunds
8. Webhook event flips payment to paid

## What was deferred

Multi-payment-method support, partial refunds, Stripe Connect (provider payouts), platform commission split, gift cards.
