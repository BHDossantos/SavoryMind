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

## Phase 5 — TBD (awaiting discuss)

Pending `/gsd-discuss-phase 5`. Candidates, ordered by current best guess:

- **5A. Real backend (Postgres + auth)** — unblocks R19 and indirectly R20, R23, R24. Largest scope.
- **5B. Batch AI analysis** — R20. Small, ships in a day, big perceived value for portfolios.
- **5C. Tested scoring engine** — R26. Defensive; should land before any major refactor.
- **5D. PDF LOI export** — R22. Mid-scope; user-visible win.
- **5E. Marketplace scraping** — R21. Highest compliance + maintenance risk.

User picks one (or sequences a few) at the discuss step.
