# AvailableNow

Real-time appointment booking for local services. Find who's available now, book instantly.

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

- Customer: `demo@availablenow.app` / `password123`
- Provider: `marco@romebarbers.it` / `password123` (any seeded barber works)
- Admin: `admin@availablenow.app` / `admin123`

## Stripe deposits

Deposits use Stripe Checkout. Set `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` in the backend `.env` to use real Stripe;
leave them empty for **stub mode**, which simulates the deposit flow
end-to-end without real money so the booking → pay → refund path is
testable locally.

## Provider approval

New providers self-signup as `pending` and don't appear in public
search until an admin approves them at `/admin/providers?status=pending`.

## Out of scope (next slices)

Push/SMS/WhatsApp reminders, real geosearch with Google Places,
auto-fill cancellations, promotions, multi-business accounts,
disputes/refund workflow.
