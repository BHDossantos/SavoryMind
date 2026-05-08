# CLAUDE.md

Slotly project context for Claude Code (and other AI runtimes). Sections below are marker-bounded so individual sections can be re-generated without overwriting the rest.

<!-- GSD:project-start source:.planning/PROJECT.md -->
## Project

**Slotly — Real-time appointment booking for local services.**

Find who's available now, book instantly, never call or text again.

The killer feature is real-time availability. Most booking apps show businesses; Slotly shows **open slots**. The default search returns providers with bookable slots in the next 2h.

**Launch slice:** men's grooming in Rome (Trastevere, Centro Storico, Monti, Testaccio, San Giovanni, Parioli, EUR, Prati). Expansion path: hair salons → nails → lashes → brows → massage → makeup → wellness → fitness.

**User roles:** customer, provider, admin. (Multi-employee `Business` accounts deferred past v1.)

For the full vision, locked decisions, success criteria, and intentional cuts, see [`.planning/PROJECT.md`](.planning/PROJECT.md).
<!-- GSD:project-end -->

<!-- GSD:stack-start source:.planning/codebase/STACK.md -->
## Technology Stack

- **Backend** Python 3.11 / FastAPI 0.115 / SQLModel 0.0.22 / SQLite (Postgres-ready via `DATABASE_URL`) / uvicorn @ port 8001
- **Frontend** Node 20 / Next.js 14.2 (App Router) / React 18.3 / TypeScript 5.6 / Tailwind 3.4 @ port 3001
- **Auth** JWT bearer (issued by backend, stored in `localStorage` as `slotly.token`)
- **Payments** Stripe Checkout via `payments_client.py` — stub mode when `STRIPE_SECRET_KEY` is unset
- **Email** Resend via `email_client.py` — stub mode when `RESEND_API_KEY` is unset
- **Scheduler** APScheduler `BackgroundScheduler` in-process tick (default 60s)
- **Hashing** passlib 1.7.4 + bcrypt **pinned to 4.0.1** (4.1+ is incompatible with passlib 1.7.4)

Full versions and run/build commands: [`.planning/codebase/STACK.md`](.planning/codebase/STACK.md).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:.planning/codebase/CONVENTIONS.md -->
## Conventions

**Backend**
- Routers are thin; logic in `*_service.py` / `*_engine.py` / `*_client.py`.
- One router per feature area; each registers its own prefix + tags.
- All responses are Pydantic models (or 204). Errors via `HTTPException`.
- Money is integer cents (`*_cents`). Timestamps are naïve UTC.
- Type hints everywhere. No comments unless the *why* is non-obvious.
- Stub-mode pattern is mandatory for external integrations: when the API key is unset, the wrapper persists realistic state and skips the network call.

**Frontend**
- Pure App Router under `app/`. All HTTP through `lib/api.ts`.
- JWT in `localStorage` (`slotly.token`); `getStoredUser()` is the auth check; pages route to `/login?next=...` when null.
- Tailwind only; brand accent emerald-500, ink slate-900; status pills use 100/700 pairings.
- Pages reading `useSearchParams()` wrap in `<Suspense>`.

**Git**
- Conventional prefixes: `feat(slotly): ...`, `chore(slotly): ...`, `fix(slotly): ...`, `docs(slotly): ...`.
- Subject ≤ 72 chars; body explains the *why*.

**Tests**
- No automated suite yet — every feature was verified via an end-to-end smoke script (recorded in commit messages and `.planning/phases/*-SUMMARY.md`). **`pytest` harness is the most overdue piece of housekeeping.**

Full conventions: [`.planning/codebase/CONVENTIONS.md`](.planning/codebase/CONVENTIONS.md).
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:.planning/codebase/ARCHITECTURE.md -->
## Architecture

Two-tier app: FastAPI backend ↔ Next.js frontend, single SQLite DB, in-process notification scheduler, Stripe + Resend integrations with stub fallbacks.

**Backend layout (`backend/app/`)**
- `main.py` (app + scheduler), `config.py` (env settings), `db.py` (engine + session)
- `models.py` (User, Provider, Service, Availability, BlockedTime, Appointment, Payment, Review, Notification)
- `schemas.py`, `security.py`, `availability_engine.py`, `notifications_service.py`, `payments_client.py`, `email_client.py`, `seed.py`
- `routers/` — auth, providers, services, availability, search, appointments, reviews, payments, admin

**Frontend layout (`frontend/app/`)**
- Customer flows: `page.tsx`, `search/`, `providers/[id]/`, `book/[serviceId]/`, `booking/success/`, `appointments/` (+ `[id]/review/`)
- Auth: `login/`, `signup/`
- Provider dashboard: `provider/` (+ `profile/`, `services/`, `availability/`)
- Admin (gated to `Role.admin`): `admin/` with sub-pages `providers/`, `bookings/`, `users/`, `notifications/`

**Key patterns**
- Booking with deposit: backend creates Appointment + Payment in `pending`, returns Stripe Checkout URL; webhook (or stub-confirm) flips to `paid` and enqueues notifications.
- Slot computation: working hours minus blocked time minus active bookings, walked in 15-min steps.
- Notification lifecycle: lifecycle event → enqueue → APScheduler tick → `email_client.send_email`.
- Approval gate: public search + profile only return `approval_status=approved`.

Full diagrams + flows: [`.planning/codebase/ARCHITECTURE.md`](.planning/codebase/ARCHITECTURE.md).
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:.claude/skills/ -->
## Project Skills

No project skills installed yet. To add one, drop a `SKILL.md` (with YAML frontmatter `name` + `description`) into `.claude/skills/<skill-name>/`. GSD's bundled skills under `.claude/get-shit-done/` are framework-internal and excluded.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work
- `/gsd-plan-phase` to plan a new phase from `REQUIREMENTS.md`
- `/gsd-new-project` is **not** the entry point here — Slotly is already initialised; planning artifacts live under `.planning/` and the roadmap is at `.planning/ROADMAP.md`.

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` — do not edit manually.
<!-- GSD:profile-end -->

---

## Quick reference

**Run locally**
```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python -m app.seed
uvicorn app.main:app --reload --port 8001

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

**Demo logins**
- Customer: `demo@slotly.app` / `password123`
- Provider: any seeded barber, e.g. `marco@romebarbers.it` / `password123`
- Admin: `admin@slotly.app` / `admin123`

**Where things live**
- Vision + decisions → `.planning/PROJECT.md`, `.planning/STATE.md`
- Requirements → `.planning/REQUIREMENTS.md` (REQ-001..067 done; REQ-100..161 backlog)
- Phase history → `.planning/phases/01..06-SUMMARY.md`
- Codebase docs → `.planning/codebase/{STACK,ARCHITECTURE,CONVENTIONS}.md`
- Migration to standalone repo → `MIGRATION.md` + `migrate-to-slotly.sh`
