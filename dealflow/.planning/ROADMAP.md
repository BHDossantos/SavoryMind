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

## Phase 6 — TBD (awaiting discuss)

Pending `/gsd-discuss-phase 6`. Remaining candidates from the original list:

- **6A. Batch AI analysis** — R20. Small, ships in a day, big perceived value for portfolios.
- **6B. Real backend (Postgres + auth)** — R19. Largest scope; unblocks R23, R24.
- **6C. PDF LOI export** — R22. Mid-scope; user-visible win.
- **6D. Marketplace scraping** — R21. Highest compliance + maintenance risk.
