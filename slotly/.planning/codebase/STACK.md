<!-- generated-by: gsd-doc-writer -->
# Technology Stack

**Analysis date:** 2026-04-30

## Languages

**Primary:**
- Python 3.11 — backend (`backend/app/**`)
- TypeScript 5.6 — frontend (`frontend/app/**`, `frontend/lib/**`, `frontend/components/**`)

**Secondary:**
- Bash — `migrate-to-slotly.sh`
- JavaScript (Node) — Tailwind / PostCSS / Next config

## Runtime

- **Backend**: Python 3.11 + uvicorn ASGI server, port `8001`
- **Frontend**: Node.js 20.x + Next.js 14 dev/build server, port `3001`
- **Database**: SQLite (file at `backend/slotly.db`); Postgres-compatible via `DATABASE_URL`

## Backend dependencies

- `fastapi 0.115` — web framework
- `sqlmodel 0.0.22` — ORM (SQLAlchemy 2 + Pydantic 2)
- `pydantic 2.9` + `pydantic-settings 2.5`
- `python-jose[cryptography] 3.3` — JWT
- `passlib 1.7.4` + `bcrypt 4.0.1` — password hashing (bcrypt pinned to 4.0.1 — passlib 1.7.4 is incompatible with bcrypt 4.1+)
- `python-multipart 0.0.12` — form parsing
- `email-validator 2.2`
- `stripe 10.12` — Stripe Checkout integration
- `apscheduler 3.10.4` — in-process notification scheduler
- `httpx 0.27.2` — Resend HTTP client

## Frontend dependencies

- `next 14.2.15` (App Router)
- `react 18.3.1` + `react-dom 18.3.1`
- `tailwindcss 3.4.13` + `postcss 8.4.47` + `autoprefixer 10.4.20`
- TypeScript 5.6.2

## External services

- **Stripe** — deposits (Checkout). Stub mode when `STRIPE_SECRET_KEY` is empty.
- **Resend** — transactional email + reminders. Stub mode when `RESEND_API_KEY` is empty.

## Auth

JWT bearer in `Authorization` header. Tokens issued by the backend on
signup / login; expiry default 7 days. Frontend stores in
`localStorage` under `slotly.token` / `slotly.user`.

## Build / run

| Task | Command |
|---|---|
| Install backend deps | `cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt` |
| Seed DB | `cd backend && .venv/bin/python -m app.seed` |
| Run backend | `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8001` |
| Install frontend deps | `cd frontend && npm install` |
| Run frontend | `cd frontend && npm run dev` |
| Build frontend | `cd frontend && npm run build` |

## Not used (deliberate)

No Supabase, no Auth0, no Redis, no Celery, no Postgres yet (SQLite
is enough for v1). No Expo / React Native — PWA only.
