# Slotly — STATE

## Current position

**Phase 07 — Auto-fill cancellations** is done.

Last shipped commit on `claude/appointment-booking-platform-FYizt`:
- `(this commit) feat(slotly): Phase 07 — auto-fill cancellations`

## What is live

- 38 backend routes (auth, providers, services, availability, search, appointments, reviews, payments, admin, admin/notifications)
- 18 frontend pages (landing, search, provider profile, booking, my appointments, review, login/signup, provider dashboard / profile / services / availability, admin dashboard / providers / bookings / users / notifications, booking-success)
- Three demo logins seeded: `demo@slotly.app`, any of 10 seeded barbers (e.g. `marco@romebarbers.it`), `admin@slotly.app`
- Stripe Checkout + Resend both work without real API keys via stub modes

## Decisions made

- **D-01** Single-product repo (FastAPI + Next.js + Expo planned for later) instead of split-repo. Easier for one engineer to operate. (Phase 01)
- **D-02** SQLite default, Postgres-ready via `DATABASE_URL`. SQLite is enough for dev + the first 50 providers. (Phase 01)
- **D-03** No Supabase / Auth0 — JWT bearer is enough until we need OAuth providers. (Phase 01)
- **D-04** "Available now" is the default search intent and the brand promise. UI defaults the filter to on. (Phase 01)
- **D-05** Reviews update provider rating **additively**, not by recompute. Preserves the seeded demo numbers when the first real review lands. (Phase 02)
- **D-06** Stripe Checkout (redirect) over Stripe Elements. Simpler, fewer client-side dependencies. (Phase 03)
- **D-07** Stub mode for Stripe + Resend: when API keys are unset, the integrations record state locally and skip external calls. Lets dev/CI exercise the full flow without secrets. (Phase 03, 05)
- **D-08** Pending-payment TTL of 15 min. Slots blocked while a customer is in checkout, released if they abandon. (Phase 03)
- **D-09** Refund policy: customer cancellation >2h before start = refund, otherwise forfeit; provider cancellation = always refund. (Phase 03)
- **D-10** New providers default to `approval_status=pending` and are hidden from public search until admin approves. Seeded providers ship as `approved`. (Phase 04)
- **D-11** APScheduler in-process for the notification tick. Move to a sidecar / cron when we outgrow a single instance. (Phase 05)
- **D-12** Notification enqueue is **idempotent** by `(appointment_id, kind)`. Safe to call twice from the booking and payment paths. (Phase 05)
- **D-13** Deposit bookings only enqueue the customer notifications **after** payment confirms, not at booking time. Avoids spamming customers whose deposit never lands. (Phase 05)
- **D-14** Anonymous searches are NOT logged into `SearchLog`. Only authenticated customers get auto-fill broadcasts. Anonymous users have no contact channel anyway. (Phase 07)
- **D-15** Auto-fill match key is `(category, city)`. Neighborhood-level matching is deferred until lat/lng + radius search lands. (Phase 07)
- **D-16** Per-user rate limit is 24h between `auto_fill_slot` notifications. Protects against a chatty provider cancelling repeatedly. Configurable via `AUTO_FILL_USER_RATE_LIMIT_HOURS`. (Phase 07)
- **D-17** Per-broadcast cap is 20 recipients, ordered by most-recent-search-first. Ensures the warmest leads win the race to book. Configurable via `AUTO_FILL_MAX_RECIPIENTS`. (Phase 07)
- **D-18** Past-slot cancellations don't broadcast. Nothing to offer. (Phase 07)

## Open questions

- **Q-01** Do we need a `Business` table for shops with multiple barbers in v1, or wait until a customer asks? Deferred — most Rome barbers operate as solo accounts.
- **Q-02** Cancellation policy — do we need provider-configurable policies (flexible / moderate / strict) or is a flat 2h rule enough for v1? Flat for now.
- **Q-03** Reviews — moderation? For v1 anyone can post; admin manual takedown via DB. Add moderation tooling if abuse appears.
- **Q-04** ~~GSD installer — should we run `npx get-shit-done-cc@latest` in `slotly/`?~~ **Resolved Phase 06.** Installed for Claude Code: 85 commands under `.claude/commands/gsd/`, 33 agents under `.claude/agents/`, 11 hooks under `.claude/hooks/`, plus framework data under `.claude/get-shit-done/`. Hand-rolled `.planning/` files reconciled to the official `config.json` schema.
- **Q-05** ~~GSD wants a project-root `CLAUDE.md` with marker-bounded sections...~~ **Resolved Phase 06.** The bundled `gsd-tools` (`.claude/get-shit-done/bin/gsd-tools.cjs`) does not have a `generate-claude-md` subcommand — the doc generation is meant to be run by the Claude Code agent itself via the `/gsd-` slash commands. Hand-wrote the equivalent: `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md` (each with the `<!-- generated-by: gsd-doc-writer -->` provenance marker so future regens can replace them safely), plus `CLAUDE.md` at the project root with all 7 GSD marker-bounded sections. Also discovered + dropped `gates` / `safety` keys from `.planning/config.json` — they're in the framework's starter template but not in this version's official schema.

## Blockers

None.

## Migration to BHDossantos/Slotly

The new repo is at `https://github.com/BHDossantos/Slotly`. Migration kit lives at `slotly/MIGRATION.md`. The Claude Code session does **not** have GitHub MCP access to push to that repo (scope is locked to `bhdossantos/savorymind`); the repo owner runs the migration script themselves.
