# FitNow

Real-time booking and wellness marketplace. Find a workout, trainer, class, or wellness session available now — and book instantly.

## Vertical scope

Gyms, fitness classes, personal trainers, BJJ / martial arts, yoga, pilates, CrossFit, massage / recovery, sauna / cold plunge, nutrition coaching, meal prep, and workout plans.

Launch market: **Rome**. First categories: BJJ / martial arts, boxing, yoga / pilates, personal training, gym day passes.

See [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) for the full spec — problems, users, data model, API surface, MVP phases, monetization, metrics.

## Repo layout

```
backend/    API server (NestJS or FastAPI — TBD)
frontend/   Web client (Next.js + Tailwind, PWA)
database/   SQL migrations and seed data (Postgres)
docs/       Product brief, ADRs, schema notes
scripts/    Local dev and ops helpers
.claude/    GSD skills, agents, hooks (committed; checked into the repo)
.planning/  GSD planning artifacts (PROJECT, ROADMAP, STATE, phases) — created on first `/gsd-new-project`
```

## Development workflow

This project uses [**GSD (Get Shit Done)**](https://github.com/gsd-build/get-shit-done) — a spec-driven, multi-agent workflow for Claude Code.

The cycle is **Discuss → Plan → Execute → Verify → Ship**, repeated per phase. Key slash commands:

- `/gsd-new-project` — bootstrap `.planning/` with PROJECT, REQUIREMENTS, ROADMAP
- `/gsd-discuss-phase N` — capture decisions before planning
- `/gsd-plan-phase N` — research + atomic task plans
- `/gsd-execute-phase N` — run plans in dependency-ordered waves
- `/gsd-verify-work N` — UAT with automated diagnosis
- `/gsd-ship N` — generate the PR
- `/gsd-quick` — for small tasks that don't need a phase
- `/gsd-help` — full command list

Open this directory in Claude Code and run `/gsd-new-project` to begin.

## Tech stack (planned)

- **Frontend**: Next.js, Tailwind CSS, PWA
- **Backend**: Node.js / NestJS *or* Spring Boot (decision pending)
- **Database**: PostgreSQL
- **Payments**: Stripe
- **Auth**: Supabase Auth or Auth0
- **Maps**: Google Maps API
- **Email**: Resend or SendGrid
- **Mobile (later)**: React Native / Expo

## Status

Skeleton + GSD installed. No application code yet. Next step: run `/gsd-new-project` in Claude Code to convert `docs/PRODUCT_BRIEF.md` into a GSD `.planning/` structure (PROJECT, REQUIREMENTS, ROADMAP), then `/gsd-discuss-phase 1` for the core booking phase.

## Quickstart (once code lands)

```bash
cp .env.example .env
docker compose up -d
```

## License

TBD.
