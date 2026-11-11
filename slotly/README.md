# Slotly

Real-time appointment booking for local services. Find who's available now, book instantly.

This project follows the [GSD spec-driven workflow](https://github.com/gsd-build/get-shit-done). Vision, requirements, roadmap, and per-phase summaries live in [`.planning/`](.planning/).

Currently parked inside `BHDossantos/SavoryMind` while we prepare the move to `BHDossantos/Slotly` — see [`MIGRATION.md`](MIGRATION.md).

This v0 covers the end-to-end booking loop: signup → provider profile + services + availability → customer search → book → cancel.

## Stack

- Backend: FastAPI + SQLModel + SQLite (Postgres-compatible via `DATABASE_URL`)
- Frontend: Next.js 15 (App Router) + Tailwind
- Auth: JWT in `Authorization: Bearer` header

## Run

Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed         # creates DB and seeds Rome barbers
uvicorn app.main:app --reload --port 8001
```

Frontend:
```bash
cd frontend
npm install
npm run dev                # http://localhost:3001
```

The frontend reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8001`).

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest          # booking, security regressions, slot engine, notifications, auto-fill
```

Tests run against a fresh in-memory SQLite per test with Stripe + Resend in
stub mode — no API keys or running server needed. CI runs them on every PR
touching `slotly/`.

## Demo logins

- Customer: `demo@slotly.app` / `password123`
- Provider: `marco@romebarbers.it` / `password123` (any seeded barber works)
- Admin: `admin@slotly.app` / `admin123`

## Stripe deposits

Demo mode is the default (`INTEGRATIONS_MODE=stub`) and never sends email or calls Stripe, even when keys are present. Production refuses to start in stub mode, with a weak JWT secret, or without HTTPS. Demo seeding is disabled in production/live mode. This is not production release certification; see [AUDIT.md](AUDIT.md).

Deposits use Stripe Checkout. For a separately reviewed live environment, explicitly set `INTEGRATIONS_MODE=live`, `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` in the backend `.env` to use real Stripe;
keep `INTEGRATIONS_MODE=stub` for **stub mode**, which simulates the deposit flow
end-to-end without real money so the booking → pay → refund path is
testable locally.

## Provider approval

New providers self-signup as `pending` and don't appear in public
search until an admin approves them at `/admin/providers?status=pending`.

## Email notifications

Booking confirmation + 24h and 2h reminders + cancellation emails are
enqueued automatically as bookings move through their lifecycle. An
in-process APScheduler tick (default every 60s) sends due notifications
via Resend.

Live mode also requires `RESEND_API_KEY`; use `INTEGRATIONS_MODE=stub` for stub mode (the
`Notification` row is the only record). Admin can audit + manually run
the queue at `/admin/notifications`.

## Out of scope (next slices)

SMS/WhatsApp reminders, real geosearch with Google Places, auto-fill
cancellations, promotions, multi-business accounts, disputes/refund
workflow.
