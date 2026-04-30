# Slotly

Real-time appointment booking for local services. Find who's available now, book instantly.

This project follows the [GSD spec-driven workflow](https://github.com/gsd-build/get-shit-done). Vision, requirements, roadmap, and per-phase summaries live in [`.planning/`](.planning/).

Currently parked inside `BHDossantos/SavoryMind` while we prepare the move to `BHDossantos/Slotly` — see [`MIGRATION.md`](MIGRATION.md).

This v0 covers the end-to-end booking loop: signup → provider profile + services + availability → customer search → book → cancel.

## Stack

- Backend: FastAPI + SQLModel + SQLite (Postgres-compatible via `DATABASE_URL`)
- Frontend: Next.js 14 (App Router) + Tailwind
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

## Demo logins

- Customer: `demo@slotly.app` / `password123`
- Provider: `marco@romebarbers.it` / `password123` (any seeded barber works)
- Admin: `admin@slotly.app` / `admin123`

## Stripe deposits

Deposits use Stripe Checkout. Set `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` in the backend `.env` to use real Stripe;
leave them empty for **stub mode**, which simulates the deposit flow
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

Set `RESEND_API_KEY` for real sends; leave empty for stub mode (the
`Notification` row is the only record). Admin can audit + manually run
the queue at `/admin/notifications`.

## Out of scope (next slices)

SMS/WhatsApp reminders, real geosearch with Google Places, auto-fill
cancellations, promotions, multi-business accounts, disputes/refund
workflow.
