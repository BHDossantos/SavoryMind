<!-- generated-by: gsd-doc-writer -->
# Conventions

**Analysis date:** 2026-04-30

## Backend (Python)

### File / module layout

- Routers are thin wrappers; business logic lives in `*_service.py` (notifications) or `*_engine.py` (availability) or stays in the router only when trivially small.
- One router file per feature area (`auth.py`, `providers.py`, `appointments.py`, …). Routers register their own `prefix` and `tags`.
- External-service wrappers live next to `app/` as `*_client.py` (`payments_client.py`, `email_client.py`). Each has an `is_stub_mode()` and behaves identically without API keys.
- Models live in a single `models.py` file. SQLModel classes with `table=True`. Enums are defined right above their owning table.

### Style

- Type hints everywhere, including return types.
- `from __future__ import annotations` only where forward refs require it.
- Imports grouped: stdlib → third-party → first-party. Black-style trailing commas.
- No comments unless the *why* is non-obvious — class names, field names, and function names carry the meaning.
- `# noqa: BLE001` only on intentional broad excepts (the notification tick, the webhook fallback).

### Endpoints

- All endpoints return Pydantic models (or `204 No Content`). No raw dicts as response shape.
- IDs in path; filters in query. Bodies are Pydantic `*In` schemas.
- Errors via `HTTPException(status_code=..., detail=...)`. Status codes follow REST norms: 400 client error, 401 unauth, 403 role gate, 404 missing, 409 conflict (booking double-book, duplicate review), 500 should never be hand-raised.

### Auth

- Use `Depends(get_current_user)` for any-authenticated route.
- Use `Depends(require_role(Role.X))` for role-gated routes.
- Never read the bearer token outside `security.py`.

### Models

- Money is always integer cents (`*_cents`).
- Timestamps are naïve `datetime.utcnow()` — server is implicitly UTC. (Future: switch to timezone-aware once we go multi-region.)
- `created_at` / `updated_at` are populated in code, not by the DB.
- Foreign keys use `Field(foreign_key="user.id")` with explicit `index=True` on hot lookups.
- Enums are string enums (`class X(str, Enum)`) so they serialise cleanly.

### Stub modes (for external services)

When the API key is unset, the client wrapper:
1. Returns realistic-looking IDs / URLs (e.g. `pi_stub_<token>`, redirect to in-app success page).
2. Skips the network call.
3. Persists the same DB rows as the real path so the rest of the system behaves identically.

This pattern is the Slotly way — every external integration must support it.

## Frontend (TypeScript / React)

### File / module layout

- Pure App Router. Pages live under `app/`. Each route is `app/<segment>/page.tsx`.
- Layouts under `app/<segment>/layout.tsx`. Admin routes have their own layout for the tab nav + role gate.
- Reusable UI under `components/`.
- Single typed API client at `lib/api.ts`. All HTTP goes through it; no `fetch()` in pages.

### Auth + state

- JWT in `localStorage` (`slotly.token`). Read by `lib/api.ts`.
- `getStoredUser()` returns `User | null`; pages route to `/login?next=...` when null.
- No global state library — `useState` + `useEffect` per page is enough.

### Forms

- Controlled inputs only.
- Errors render inline below the form. Success states either redirect or render a small banner; we don't show toasts.
- Disable submit while pending; restore on response.

### Styling

- Tailwind only. No CSS modules, no styled-components.
- Brand accent: `bg-accent` / `text-accent` (emerald 500). Brand ink: `text-ink` / `bg-ink` (slate 900).
- Status pills use 100/700 pairings (`bg-emerald-100 text-emerald-700`, etc.).

### Suspense

`useSearchParams()` requires Suspense in Next 14 build. Pages that read query params split into a thin default export wrapping a `<Suspense>` around an `Inner` component.

## Git

### Branches

Working branch: `claude/appointment-booking-platform-FYizt`. Main remains main. Feature work is squash-merged via PR.

### Commits

- Conventional-commit prefixes: `feat(slotly): ...`, `chore(slotly): ...`, `fix(slotly): ...`, `docs(slotly): ...`.
- Subject ≤ 72 chars. Body explains the *why*; "what" is in the diff.
- Multi-paragraph bodies allowed for substantive features (see the Phase 03 deposits commit).
- Always end with `https://claude.ai/code/session_*` trailer when authored via Claude Code.

### Migrations

Currently SQLModel auto-creates tables on startup (`init_db()`). When we move to Postgres or introduce destructive schema changes, switch to Alembic.

## Tests

`pytest` suite under `backend/tests/` (landed in Phase 07.1). Run with:

```bash
cd backend && python -m pytest
```

Conventions:
- `pytest` + FastAPI `TestClient` for the backend. The plain (non-context-manager) `TestClient` is deliberate — it skips startup hooks so the APScheduler tick never runs during tests.
- Fresh **in-memory SQLite** per test (`StaticPool` so all sessions share one connection); `get_session` is dependency-overridden in `conftest.py`.
- API-level factories in `conftest.py`: `signup(...)`, `make_provider(...)` (provider + service + all-week availability), `tomorrow_at(...)` / `days_ahead_at(...)`.
- One file per behaviour area: `test_booking.py`, `test_slot_engine.py`, `test_notifications.py`, `test_auto_fill.py`.
- No real Stripe / Resend in tests — **stub mode is the test mode** (no API keys set).
- Timing gotcha: a booking "tomorrow" makes its 24h reminder due immediately. Tests asserting on due counts must book ≥3 days out (`days_ahead_at`).
- CI: `.github/workflows/test.yml` (active post-migration); mirrored at the SavoryMind root as `slotly-tests.yml` while parked.

## Documentation

- `.planning/` holds the GSD spec stack (PROJECT, REQUIREMENTS, ROADMAP, STATE, phase summaries).
- `.planning/codebase/` holds living codebase docs (this file, plus STACK + ARCHITECTURE).
- `README.md` is the human-facing entry point — keep it short.
- `MIGRATION.md` is the runbook for moving the project to its own repo.
- Avoid creating new top-level docs without a clear reason; the GSD framework prefers everything under `.planning/`.
