# Roadmap: SavoryMind — Post-PR-#18 Milestone

**Created:** 2026-05-07
**Granularity:** Coarse (2 phases, 1-3 plans each)
**Total v1 requirements:** 11 — all mapped ✓

## Milestone Overview

| # | Phase | Goal | Requirements | Plans (est.) | UI hint |
|---|---|---|---|---|---|
| 1 | Restaurant Inventory Tracking | Restaurant operators can track inventory per-SKU with append-only ledger, weekly low-stock digest, and Claude-assisted categorization. Web + mobile parity from day one. | INV-01–08 (8) | 3 plans | yes |
| 2 | Mobile Consumer Parity Backlog | Close the 3 web-only gaps so mobile consumers reach feature parity. No backend work — pure frontend port. | PAR-01–03 (3) | 1 plan | yes |

**Coverage:** 11 / 11 requirements mapped (100%) ✓

---

## Phase 1: Restaurant Inventory Tracking

**Goal:** Restaurant operators can track every SKU (alcohol / food / produce / dry_goods / kitchen_supply / cleaning) via an append-only adjustment ledger, get a once-weekly low-stock digest, and add new items with Claude auto-categorizing from the name. Web + mobile parity required at ship.

**Requirements:** INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08

**Plans (estimated, refined during `/gsd-plan-phase 1`):**

1. **Backend foundation** — `InventoryItem` + `InventoryAdjustment` SQLAlchemy models + Alembic migration. CRUD + `/api/inventory/{id}/adjust` ledger endpoint. `current_quantity` computed view (or trigger-maintained denormalization on Postgres). Soft-delete via `archived_at`. Claude `categorize()` endpoint via `claude_client` with rules-based fallback. Reports CSV export updated. **~6 endpoints + 1 migration + ~12 backend tests.**
2. **Weekly digest job** — Scheduled task (Cloud Run job triggered by Cloud Scheduler, Mon 8am UTC + per-restaurant timezone offset). Picks every item where `current_quantity < par_level`. Writes one `Notification` row per restaurant + (optionally) sends one Resend email. Idempotent — re-runs in the same week update the existing notification rather than spam. **~3 backend tests covering: items below par, items at par, no items below par.**
3. **Web + mobile inventory UIs** — `frontend/src/pages/restaurant/inventory.js` (Tailwind, table + quick-adjust modal) and `mobile/app/(restaurant)/inventory.js` (large-button counting UI). Both consume the same `/api/inventory/*` endpoints. Category auto-suggest via `POST /api/inventory/categorize` on item-name blur. Empty-state copy that names the action ("No inventory yet — add your first item"). **~5 web jest tests + ~5 mobile jest tests.**

**Success criteria:**
1. ✓ Restaurant operator on web AND mobile can create an item, log a delivery (`+24 bottles`), log usage (`-3 bottles`), and the displayed `current_quantity` reflects `21` on both platforms (parity verified).
2. ✓ Adjustment ledger is append-only — no UPDATE or DELETE on `InventoryAdjustment` rows is exposed via API. Verified by attempting both and getting 405/403.
3. ✓ Adding a new item with name "Tito's Vodka 1.75L" (or similar) gets auto-categorized as `alcohol` by Claude. With `ANTHROPIC_API_KEY` unset, falls back to `food` and the form lets the user override before save.
4. ✓ Weekly digest job triggered manually creates exactly one `Notification` per restaurant with items below par, and (when Resend key set) sends exactly one email per restaurant. Re-running the same week is idempotent.
5. ✓ All 165 existing tests still pass + ~25 new tests added (~12 backend + ~5 web + ~5 mobile + ~3 digest job). All three CI workflow jobs green.

**Verification (post-execution):** `/gsd-verify-work 1` confirms all 5 success criteria observable in the running app.

---

## Phase 2: Mobile Consumer Parity Backlog

**Goal:** Close the 3 web-only consumer screens so mobile consumers reach feature parity. Backend endpoints already exist; this is pure mobile-frontend work.

**Requirements:** PAR-01, PAR-02, PAR-03

**Plans (estimated):**

1. **Mobile screen ports** — Three new files under `mobile/app/(consumer)/`: `order.js` (food delivery, calls `getDeliveryDishes` / `getDeliveryRestaurants`), `guided-cooking.js` (calls `getRecipe` / `createMemory` / `askAssistant`), `beverages.js` (calls `getBeerPairing` / `getSpiritsPairing`). Each ports the visual hierarchy from its web counterpart but uses `react-native` + `expo-router` primitives. Add nav entries to `mobile/app/(consumer)/_layout.js`. **~6 mobile jest tests (2 per screen: empty/populated).**

**Success criteria:**
1. ✓ Mobile consumer with seeded delivery data sees dishes + restaurants on the order screen, can tap to filter by restaurant, and the populated state matches web (verified by side-by-side screenshot or feature comparison).
2. ✓ Mobile consumer can open a recipe in guided-cooking, see the ingredient + step list, and tap to ask the assistant a clarifying question — same flow as web.
3. ✓ Mobile consumer on the beverages screen can pick a dish and see beer + spirits pairings populated — same `BeerPairing` + `SpiritsPairing` shapes as web consumes.
4. ✓ Three new entries appear in mobile consumer nav. No existing screens broken (full mobile jest suite still 53/53 + 6 new = 59/59).

**Verification:** `/gsd-verify-work 2` confirms all 4 criteria + a side-by-side parity check against the existing web pages.

---

## Backlog (post-milestone)

Captured for future milestones. Not in this roadmap.

- **Inventory v2** — par-level AI suggestions (INV-V2-01), anomaly detection (INV-V2-02), recipe→ingredient mapping + auto-decrement (INV-V2-03). All require ≥4 weeks of usage data; revisit Q3 2026.
- **JTI revocation cron** — Currently pruned opportunistically on every refresh; switch to a scheduled cleanup job once DAU crosses 100k. Not urgent.
- **Real-device mobile smoke-test infrastructure** — Sandbox couldn't validate iOS/Android in PR #18; first real-device verification happens after each mobile-touching deploy. Could be scripted with Maestro / Detox.

---
*Roadmap created: 2026-05-07 via `/gsd-new-project` (post PR-#18 merge)*
*Granularity: coarse · Mode: yolo · Parallelization: enabled*
