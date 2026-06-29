# Requirements: SavoryMind — Post-PR-#18 Milestone

**Defined:** 2026-05-07
**Core Value:** Restaurants and home cooks make better decisions about food when AI surfaces patterns they can't see manually — what dishes drive repeat visits, what's about to run out, what wine pairs with tonight's listening mood, what reviewers actually complain about.

> **Brownfield note:** SavoryMind is a shipped product. Pre-PR-#18 features are tracked as **Validated** in `PROJECT.md`. This file scopes only **new** work for the current milestone.

## v1 Requirements

### Inventory tracking (restaurant side)

- [ ] **INV-01**: Restaurant operator can create inventory items with name, category (one of: alcohol / food / produce / dry_goods / kitchen_supply / cleaning), unit (bottles / kg / cases / each / liters), `current_quantity`, `par_level` (warn-below threshold), and optional `reorder_quantity`, `supplier`, `cost_per_unit`, `notes`
- [ ] **INV-02**: Restaurant operator can record inventory adjustments (`delivery` / `usage` / `waste` / `count_correction`) as append-only ledger entries; `current_quantity` is derived from the ledger so audit trail is complete and tamper-evident
- [ ] **INV-03**: Restaurant operator can quick-adjust quantities from a counting-optimized UI (large +/- buttons, +/- case-pack buttons) without re-entering the full row — works on web AND mobile
- [ ] **INV-04**: Restaurant operator receives a weekly low-stock digest (Monday 8am restaurant-local) — one in-app `Notification` row + one Resend email summarizing every item where `current_quantity < par_level`, grouped by category
- [ ] **INV-05**: When adding a new item, Claude auto-suggests its category from the item name (web + mobile, with manual override). Falls back gracefully when `ANTHROPIC_API_KEY` unset (defaults to "food")
- [ ] **INV-06**: Inventory page exists on web (`frontend/src/pages/restaurant/inventory.js`) AND mobile (`mobile/app/(restaurant)/inventory.js`) at first ship — no parity drift introduced
- [ ] **INV-07**: Inventory ledger entries appear in the existing restaurant reports export (CSV)
- [ ] **INV-08**: Inventory item delete is soft (sets `archived_at`) so historical adjustments stay queryable

### Mobile parity backlog

- [ ] **PAR-01**: Port `consumer/order.js` (food delivery) from web to mobile — calls existing `/api/consumer/delivery/dishes` and `/api/consumer/delivery/restaurants` endpoints
- [ ] **PAR-02**: Port `consumer/guided-cooking.js` from web to mobile — calls existing `getRecipe`, `createMemory`, `askAssistant` endpoints
- [ ] **PAR-03**: Port `consumer/beverages.js` (beer/spirits pairing) from web to mobile — calls existing `getBeerPairing`, `getSpiritsPairing` endpoints

## v2 Requirements

Deferred until inventory v1 ships and produces ≥4 weeks of usage data.

### Inventory intelligence

- **INV-V2-01**: Claude suggests `par_level` per item based on consumption history (rolling 4-week median of weekly usage × safety factor)
- **INV-V2-02**: Anomaly detection — flag items whose recent usage rate deviates >3σ from baseline ("3× normal chicken usage this week")
- **INV-V2-03**: Recipe → ingredient mapping table; menu sales decrement inventory automatically (requires recipe-mapping initiative as separate phase)

## Out of Scope

| Feature | Reason |
|---|---|
| Barcode scanning | Real value, real complexity (camera permissions, lookup APIs, damaged labels). Defer until v1 usage data shows it's the bottleneck. |
| Supplier ordering integration | Per-supplier EDI/API integration — each is its own project. Manual reorder workflow first. |
| Multi-location inventory | Adds `location_id` join through every query; defer until a real chain customer asks. |
| Real-time push notifications for low-stock | Inventory isn't a real-time signal; weekly digest is the right cadence. Daily/real-time becomes nagging. |
| Auto-decrement from menu sales | Requires recipe→ingredient mapping that doesn't exist; do that initiative first. |
| Anomaly detection in v1 | Needs ≥4 weeks of usage history per item. Punted to v2. |
| Par-level AI suggestions in v1 | Same data-availability problem. Punted to v2. |

## Traceability

Updated by roadmapper.

| Requirement | Phase | Status |
|---|---|---|
| INV-01 | Phase 1 | Pending |
| INV-02 | Phase 1 | Pending |
| INV-03 | Phase 1 | Pending |
| INV-04 | Phase 1 | Pending |
| INV-05 | Phase 1 | Pending |
| INV-06 | Phase 1 | Pending |
| INV-07 | Phase 1 | Pending |
| INV-08 | Phase 1 | Pending |
| PAR-01 | Phase 2 | Pending |
| PAR-02 | Phase 2 | Pending |
| PAR-03 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-07 after `/gsd-new-project`*
