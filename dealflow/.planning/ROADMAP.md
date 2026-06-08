# Roadmap

Phases 1–4 are complete on `claude/dealflow-ai-setup-WTRdF`. Phase 5 is
pending the next discuss step.

## Phase 1 — MVP foundation ✅

- **Status:** Shipped
- **Commit:** `77a8622`
- **Goal:** A working end-to-end deal analyzer.
- **Plans (executed sequentially in one wave):**
  - 01 Scaffold Next.js 14 + TypeScript + Tailwind under `dealflow/`
  - 02 Core scoring engine (`lib/scoring.ts`, `lib/multiples.ts`, `lib/types.ts`)
  - 03 Storage layer (`lib/storage.ts`, localStorage repo, demo seed)
  - 04 Screens: dashboard, new deal, deal detail, pipeline, LOI generator
  - 05 LOI generator template (`lib/loi.ts`)
- **Delivers:** R1–R10

## Phase 2 — Iteration on existing deals ✅

- **Status:** Shipped
- **Commit:** `2142421`
- **Goal:** Let users tweak deals and explore counterfactuals.
- **Plans:**
  - 01 Extract reusable `DealForm` component
  - 02 Edit deal route (`/deals/[id]/edit`)
  - 03 Scenario simulator with % sliders + before/after compare on the deal page
- **Delivers:** R11, R12

## Phase 3 — Multi-deal workflows + artifacts ✅

- **Status:** Shipped
- **Commit:** `ae5e519`
- **Goal:** Comparison, export, document storage.
- **Plans:**
  - 01 `/compare` page with multi-select and best-value highlighting
  - 02 CSV export utility + dashboard button
  - 03 Document attachments (base64 in localStorage with 2 MB / 5 MB guards)
- **Delivers:** R13, R14, R15

## Phase 4 — AI analysis ✅

- **Status:** Shipped
- **Commit:** `6d4fc7b`
- **Goal:** Claude Opus 4.7 narrative on the deal page.
- **Plans:**
  - 01 `/api/ai-analysis` route with adaptive thinking + json_schema output + cache_control
  - 02 `AIAnalysis` component with verdict pill, concerns, playbook, DD checklist
  - 03 Graceful fallback when `ANTHROPIC_API_KEY` is unset
- **Delivers:** R16, R17, R18

## Phase 5 — Tested scoring engine ✅

- **Status:** Shipped
- **Goal:** Lock deterministic logic behind unit tests before any rewrite.
- **Plans:**
  - 5-1 Vitest scaffolding + scoring engine tests + golden fixtures (caught and fixed an explicit-0 qualitative-score bug)
  - 5-2 CSV + LOI tests (header schema lock, escaping, conditional sections)
  - 5-3 GitHub Actions workflow on `claude/dealflow-**` + PRs, path-filtered to `dealflow/**`
- **Delivers:** R26
- **Tests:** 28 passing across 3 files (~600ms)

## Phase 6 — Backend foundation (DB + auth + API)

- **Status:** Active
- **Goal:** Replace localStorage with a real Postgres-backed multi-tenant API behind authentication. Foundation for billing, sharing, and every later phase.
- **Plans:**
  - 6-1 Drizzle ORM + Postgres schema + migrations + docker-compose for local dev
  - 6-2 Auth (NextAuth credentials provider + signup/login pages + session middleware)
  - 6-3 Deal API CRUD routes under `/api/deals` with workspace scoping
- **Delivers:** R19 (real backend + auth)
- **Authorization wall:** none — local Postgres in Docker, dev credentials only

## Phase 7 — Frontend migration to API ✅

- **Status:** Shipped
- **Goal:** Frontend reads/writes via the API instead of localStorage. One-time import flow lets existing users carry local deals in.
- **Plans:**
  - 7-1 SWR + typed API client + branch-on-authed action layer + `useDealsSource` / `useDealSource` hooks
  - 7-2 Migrate every page and the AIAnalysis + Attachments components to the new client
  - 7-3 First-login import banner moves localStorage deals into the workspace
- **Delivers:** Sellability prerequisite — every UI now lives behind auth for paying users.
- **Tests:** 63 passing across 8 files

## Phase 8 — Stripe billing

- **Status:** Pending
- **Goal:** Free / Pro €29 / Team €99-per-seat tiers with feature gating.
- **Authorization wall:** **needs Stripe account + API keys**

## Phase 9 — Production deployment + observability

- **Status:** Pending
- **Goal:** Vercel (app) + managed Postgres + Sentry + PostHog + status endpoint.
- **Authorization wall:** **needs hosting/observability accounts**

## Phase 10 — Marketing site + legal

- **Status:** Pending
- **Goal:** Landing page, pricing page, ToS + Privacy from template, waitlist capture.

## Phase 11 — Search-funder ICP features

- **Status:** Pending
- **Goal:** Portfolio view (cross-target pipeline), IC memo generator, structured DD checklist tracking.

## Phase 12 — Comp-database moat

- **Status:** Pending
- **Goal:** Anonymized aggregation of every analysis into an industry comp database surfaced as "how does your deal compare to the cohort".

## Phase 13 — Sale prep + repo split

- **Status:** Pending
- **Goal:** Test coverage gates, runbooks, MRR/churn/CAC reports, codebase audit, migration plan for extracting `dealflow/` to its own repository.
- **Authorization wall:** **user executes the actual `gh repo create`**
