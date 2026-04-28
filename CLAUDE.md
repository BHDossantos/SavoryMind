# SavoryMind

AI-powered culinary intelligence platform. Two connected sides:
- **Consumer**: mood/profile-driven recommendations for what to eat, cook, drink, or where to dine.
- **Restaurant**: CRM + analytics dashboard for menu performance, customer behavior, and trend insights.

The long-term thesis: consumer demand data feeds restaurant operations data.

## Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Pydantic v2. JWT auth (`backend/app/core/security.py`).
- **Frontend**: Next.js (pages router), React 18, Tailwind, recharts. NextAuth for social login.
- **Database**: SQLite by default; Postgres supported (`backend/app/core/database.py` switches on `DATABASE_URL` scheme). Production currently on SQLite over a GCS-mounted volume — Cloud SQL migration is blocked on IAM perms (commit 43a8a99).
- **Deploy**: GCP Cloud Run for both services. CI in `.github/workflows/deploy-backend.yml` and `deploy-frontend.yml`. Domain: `api.savorymind.net` (backend), `savorymind.net` (frontend).

Legacy Vercel + Render workflows still exist in `.github/workflows/` but are manual-trigger only and stale. Don't trigger them — they will rewrite DNS.

## Repo layout

```
backend/
  app/
    api/routes/     # FastAPI route modules (one per domain)
    core/           # config, database, security
    models/         # SQLAlchemy models
    schemas/        # Pydantic request/response models
    services/       # business logic (called from routes)
    ml/engine.py    # recommendation builders
frontend/
  src/
    pages/          # Next.js routes
    components/     # shared UI
    services/api.js # single source of truth for backend calls
    context/        # AuthContext etc.
mobile/             # placeholder, not active
database/           # seed/migration scripts
scripts/            # one-off ops scripts
```

## Account types

Four roles, enforced via `_require_<role>` helpers in each route file. Don't add a new role without updating `User.account_type` and the auth helpers consistently.

- `consumer` — home cooks / diners using the recommendation engine.
- `restaurant` — owners using the dashboard.
- `diner` — restaurant-discovery side of the consumer experience (bookings, reviews of platform restaurants).
- `staff` — employees of a `restaurant` user; linked via `User.employer_id`.

## What's actually built vs. aspirational

Be honest about this in any planning. The product brief describes more than what currently ships.

**Fully built and production-shaped:**
- Auth (email + social via NextAuth), onboarding, role gating.
- Restaurant dashboard: menu, sales metrics, sentiment, CRM, staff, bookings.
- Diner side: discover, book, review (booking-validated).
- Consumer side: pantry, recipes, meal plan, wine/music/beer pairings, culinary assistant.

**Stubs or static data:**
- `/api/restaurant/trends` — static / mock content, no external API integration.
- Wine, music, beer, spirits pairings — static maps + saved records, not LLM-generated.
- Culinary assistant (`backend/app/services/assistant_service.py`) — regex/tag matching over a 24-entry knowledge base. Not a real LLM call.

**Not started:**
- Voice assistant integration (Alexa, Google, Siri).
- Real-time food trend ingestion from external sources.
- POS / sales-data import (manual menu entry only).

When asked to "improve recommendations" or "add AI", check whether the feature is currently a static map before assuming there's a model to swap.

## Conventions

- **No comments in code** unless explaining a non-obvious WHY (hidden constraint, workaround for a known bug, surprising behavior). Don't restate what the code does.
- **No backwards-compat shims, dead code, or aspirational abstractions.** Three similar lines beats a premature helper.
- **Validation lives at the boundary** — Pydantic schemas in `backend/app/schemas/` for inbound, response models on routes for outbound.
- **Behavior logging is fire-and-forget.** `_log()` in `consumer.py` swallows errors; never let it break the main call.
- **Frontend talks to backend via `frontend/src/services/api.js` only.** Don't `fetch()` directly from components.
- **Error messages are user-facing strings.** `HTTPException(detail=...)` is rendered verbatim in the UI by `request()` in `api.js`.

## Local dev

Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run dev   # localhost:3000, proxies /backend/* → localhost:8000
```

Env vars: copy `frontend/.env.example` and `backend/.env.example` to `.env`. The `.env.example` files still mention old infra (Vercel/Render); ignore those references.

## Tests

There are none. `backend/tests/` does not exist. Adding even a small pytest harness is high-leverage.

## Cross-references

- Roadmap and milestones: `ROADMAP.md`
- Deployment details: `DEPLOY.md`
- First-time setup notes: `SETUP_GUIDE.md`
