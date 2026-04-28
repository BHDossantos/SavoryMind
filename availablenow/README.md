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

## Out of v0

Reviews, payments/Stripe, admin panel, push/SMS/WhatsApp, real geosearch, "auto-fill cancellations," promotions, multi-business accounts.
