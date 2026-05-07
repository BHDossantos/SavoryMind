# SavoryMind

## What This Is

SavoryMind is an AI-powered food intelligence platform serving three user types from a single backend: **consumers** (home cooks managing pantry, meal plans, recipes, wine/music/beverage pairings, food journal, delivery orders, guided cooking, AI assistant), **restaurants** (operators running menu management, bookings, CRM, staff, sentiment analysis, predictions, trends, marketing, recommendations, waste tracking, kitchen/staff time tracking, training, reports), and **diners** (restaurant patrons discovering restaurants, booking, tracking visit history). A separate **staff** role nests under restaurants for time-clock and portal access.

The product is shipped and live in production at `savorymind.net` (web) and `api.savorymind.net` (backend), with a parallel Expo mobile app. PR #18 just merged a 38-commit overhaul that delivered refresh-token auth, real Spotify OAuth + listening-signal personalisation, full Claude integration across recommendations / trends / marketing / training / review themes / culinary assistant, native Google sign-in (web + mobile), mobile SDK 55 alignment, mobile/web parity sweep, and 165-test CI coverage.

## Core Value

**Restaurants and home cooks make better decisions about food when AI surfaces patterns they can't see manually** — what dishes drive repeat visits, what's about to run out, what wine pairs with tonight's listening mood, what reviewers actually complain about. Everything else (auth, OAuth, deploy hardening) is plumbing in service of that.

## Requirements

### Validated

<!-- Shipped in production. Confirmed working via 165-test CI + manual verification. Locked. -->

#### Auth + identity
- ✓ **AUTH-01** Email/password registration + login — PR #18
- ✓ **AUTH-02** Refresh-token cookie auth (30-min in-memory access + 30-day httpOnly refresh) — PR #18
- ✓ **AUTH-03** JTI revocation on logout + rotation (replay detection) — PR #18
- ✓ **AUTH-04** Native Google sign-in via JWKS RSA verification (web + mobile) — PR #18
- ✓ **AUTH-05** `account_type` set-once guard against self-promotion — PR #18

#### Consumer
- ✓ **CONS-01** Meal planner — pre-PR-18, mobile + web
- ✓ **CONS-02** Pantry management — pre-PR-18, mobile + web
- ✓ **CONS-03** Recipe browsing — pre-PR-18, mobile + web
- ✓ **CONS-04** Wine pairing — pre-PR-18, mobile + web
- ✓ **CONS-05** Music mood + Spotify OAuth + real track search — PR #18
- ✓ **CONS-06** Beverages (beer/spirits) pairing — pre-PR-18, web only ⚠
- ✓ **CONS-07** Food journal — pre-PR-18, mobile + web
- ✓ **CONS-08** Social connections — pre-PR-18, mobile + web
- ✓ **CONS-09** Culinary assistant (Claude Opus) — PR #18, mobile + web
- ✓ **CONS-10** Food delivery orders — pre-PR-18, web only ⚠
- ✓ **CONS-11** Guided cooking — pre-PR-18, web only ⚠

#### Restaurant
- ✓ **REST-01** Menu management — pre-PR-18
- ✓ **REST-02** Bookings — pre-PR-18
- ✓ **REST-03** CRM — pre-PR-18
- ✓ **REST-04** Staff management — pre-PR-18
- ✓ **REST-05** Sentiment analysis (VADER + Claude themes/complaints/praise/tone) — PR #18
- ✓ **REST-06** Themes panel with empty-state and backfill script — PR #18
- ✓ **REST-07** Sales predictions — pre-PR-18
- ✓ **REST-08** Trends, marketing, training, recommendations (Claude-driven) — PR #18
- ✓ **REST-09** Food waste logging — pre-PR-18
- ✓ **REST-10** Kitchen time + staff time tracking — pre-PR-18
- ✓ **REST-11** Reports + export — pre-PR-18

#### Diner
- ✓ **DINE-01** Restaurant discovery — pre-PR-18, mobile + web
- ✓ **DINE-02** Restaurant detail — pre-PR-18, mobile + web
- ✓ **DINE-03** Bookings + visit history — pre-PR-18

#### Staff
- ✓ **STAF-01** Staff portal — pre-PR-18
- ✓ **STAF-02** Time clock — pre-PR-18

#### Ops + observability
- ✓ **OPS-01** `/health/deep` per-integration diagnostic — PR #18
- ✓ **OPS-02** `scripts/preflight.py` pre-merge gate — PR #18
- ✓ **OPS-03** `scripts/backfill_themes.py` retroactive enrichment — PR #18
- ✓ **OPS-04** Sentry user/JTI tagging on every authenticated request — PR #18

### Active

<!-- Hypothesis: shipping these makes the product meaningfully more useful. Until shipped, treat as unproven. -->

#### Inventory tracking (Phase 1, current milestone) — restaurant side
- [ ] **INV-01** Restaurant operator can create inventory items with name, category (alcohol / food / produce / dry_goods / kitchen_supply / cleaning), unit (bottles / kg / cases / each), `current_quantity`, `par_level` (warn-below threshold), `reorder_quantity`
- [ ] **INV-02** Restaurant operator can record inventory adjustments (delivery / usage / waste / count_correction) as append-only ledger entries; `current_quantity` is derived from the ledger so audit trail is intact
- [ ] **INV-03** Restaurant operator can quick-adjust quantities from a counting-optimized UI (large buttons, +/- 1, +/- case-pack) without re-entering the full row
- [ ] **INV-04** Restaurant operator receives weekly low-stock digest (Mon 8am restaurant-local) — one in-app notification + one Resend email summarizing every item below `par_level`
- [ ] **INV-05** When a restaurant operator adds a new item, Claude auto-suggests its category from the name (web + mobile, with manual override)
- [ ] **INV-06** Inventory page exists on web AND mobile from day one (no parity drift)
- [ ] **INV-07** Inventory data is included in restaurant reports export

#### Mobile parity backlog (Phase 2, current milestone)
- [ ] **PAR-01** Port `consumer/order.js` (food delivery) from web to mobile
- [ ] **PAR-02** Port `consumer/guided-cooking.js` from web to mobile
- [ ] **PAR-03** Port `consumer/beverages.js` (beer/spirits pairing) from web to mobile

### Out of Scope

<!-- Explicit boundaries with reasoning, to prevent scope creep on the inventory phase. -->

- **Barcode scanning** — Real value, real complexity (camera permissions, barcode lookup APIs, edge cases on damaged labels). Defer until inventory v1 has usage data showing this is the bottleneck.
- **Supplier ordering integration** — Each supplier has bespoke EDI/API; integration is a per-supplier project. Manual reorder workflow first.
- **Multi-location inventory** — Adds materialized join through restaurant_id × location_id on every query. Defer until a real chain customer asks.
- **Recipe → ingredient automatic decrement** — Requires recipe→ingredient mapping table that doesn't exist; significant data-modeling effort. Phase the recipe mapping first as its own initiative, then layer auto-decrement on top.
- **Anomaly detection** ("3× normal chicken usage this week") — Needs ≥4 weeks of usage history per item. Re-evaluate as v2 once data exists.
- **Par-level AI suggestions from history** — Same data-availability problem. Re-evaluate as v2.
- **Real-time push notifications for low-stock** — Weekly digest is the right cadence; daily/real-time becomes nagging and inventory isn't a real-time signal.

## Context

**Stack:** FastAPI 0.136 + Pydantic v2 + SQLAlchemy + Alembic on Cloud Run (Python 3.11), Postgres on Cloud SQL. Next.js 15 + Pages Router + Tailwind + Recharts on Cloud Run for web. Expo SDK 55 + RN 0.83 + expo-router + expo-auth-session on mobile. Anthropic SDK (Opus 4.7 + Haiku 4.5) with prompt caching. VADER + Claude two-stage sentiment. Fernet token encryption. Sentry. slowapi rate limiting. Resend for transactional email.

**Single monorepo:** `backend/`, `frontend/`, `mobile/`, `scripts/`, `.planning/`, `.github/workflows/`. CI: backend pytest (79) + frontend jest (33) + mobile jest (53) on every push. All three currently green at HEAD of `main`.

**Production hosts:** `api.savorymind.net` (backend), `savorymind.net` (web). Cloud SQL postgres. Sentry on. Anthropic key set. Spotify + Google client IDs partially configured (lifespan handles dormant gracefully via `enabled` / `dormant` / `misconfigured` triage in `/health/deep`).

**Authoritative refs:** `CHANGELOG.md` (every shipped feature, reverse-chron) and `DEPLOYMENT.md` (post-merge runbook for PR #18). Don't re-derive what's already in those — read them.

**Known parity drift (pre-existing):** `consumer/order.js`, `consumer/guided-cooking.js`, `consumer/beverages.js` exist on web but not mobile. Tracked as PAR-01/02/03 above. Inventory phase will not drift further — both platforms ship together.

## Constraints

- **Tech stack** — FastAPI + Postgres backend, Next.js web, Expo mobile. Locked. Adding a new framework is a separate ADR.
- **Auth model** — Refresh-token cookie + JTI revocation. Locked. Don't reintroduce localStorage JWTs.
- **OAuth tokens at rest** — Fernet-encrypted via SQLAlchemy `EncryptedText` TypeDecorator. Locked.
- **Migrations** — Alembic only. No `Base.metadata.create_all`. Locked.
- **AI calls** — Always through `app.services.claude_client` (prompt caching, JSON-schema output, refusal detection, graceful fallback). Direct `anthropic.Anthropic()` calls are forbidden.
- **AI optionality** — Every AI feature must have a rules-based fallback. Backend boots without `ANTHROPIC_API_KEY`; UI degrades cleanly.
- **Mobile/web parity** — New features ship on both platforms simultaneously. Web-only or mobile-only is a parity drift bug, not a release strategy.
- **Cookies** — `httpOnly` `Secure` `SameSite=Lax`, `COOKIE_DOMAIN=.savorymind.net` in prod.
- **CI** — All three workflow jobs (backend pytest, frontend jest, mobile jest) must be green before merge. No skipping.
- **Migration safety** — `_run_alembic_migrations()` self-heals across three states (empty / pre-Alembic stamp-head / managed). New migrations must respect this.

## Key Decisions

<!-- Locked from PR #18. Treat as ADR-equivalent. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Refresh-token cookie + JTI revocation (not localStorage JWT) | XSS-stealable tokens are unfixable; cookie + replay detection is industry standard | ✓ Good — shipped PR #18 |
| Fernet-encrypted OAuth tokens at rest | Postgres dump or compromised replica must not yield plaintext OAuth refresh tokens | ✓ Good — shipped PR #18 |
| Claude with rules-based fallback (no key required for deploy) | Don't make `ANTHROPIC_API_KEY` a deploy-blocker; users on key-less envs still get a working product | ✓ Good — shipped PR #18 |
| Alembic migrations (not `create_all`) | Multi-environment schema drift is a real risk; Alembic gives forward + rollback discipline | ✓ Good — shipped PR #18 |
| `X-Client-Type` header for web/mobile routing | Same backend, same auth, single source of truth for both clients | ✓ Good — shipped PR #18 |
| Cloud Run `--memory 1Gi --min-instances 1` | Cold starts cause cascading 503s; one warm instance is the cheapest fix | ✓ Good — shipped PR #18 |
| Native Google sign-in via JWKS RSA verification | Shared-secret pattern doesn't work for native Expo clients; ID-token verification does | ✓ Good — shipped PR #18 |
| GSD installed locally for planning | Project complexity past 100k LOC needs planning structure; in-conversation drift was already showing | ✓ Good — initialized this session |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-07 after `/gsd-new-project` initialization (post PR-#18 merge)*
