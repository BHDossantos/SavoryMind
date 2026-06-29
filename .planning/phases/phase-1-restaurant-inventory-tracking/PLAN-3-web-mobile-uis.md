# Plan 3: Web + Mobile Inventory UIs

**Phase:** 1 — Restaurant Inventory Tracking
**Goal:** Restaurant operators can manage inventory from web AND mobile with parity. Mobile is counting-optimized (big buttons, +/- case-pack actions, haptic feedback).
**Estimated commits:** 1 atomic
**Estimated tests added:** ~10 (5 web + 5 mobile)

## Tasks

### Web (`frontend/src/`)

1. **API client** (`services/api.js`) — add methods:
   - `getInventory(category)` → `GET /api/inventory?category=...`
   - `createInventoryItem(payload)` → `POST /api/inventory`
   - `updateInventoryItem(id, patch)` → `PATCH /api/inventory/{id}`
   - `archiveInventoryItem(id)` → `DELETE /api/inventory/{id}`
   - `adjustInventoryItem(id, payload)` → `POST /api/inventory/{id}/adjust`
   - `categorizeInventoryItem(name)` → `POST /api/inventory/categorize`

2. **Page** (`pages/restaurant/inventory.js`)
   - Top bar: title + category filter pills + "Add item" primary button
   - Table: Name | Category badge | Unit | Current | Par | Status | Actions
   - Sort: low-stock first (computed `is_low === true`), then alphabetical by name
   - Empty state when 0 items: friendly copy + add-item CTA
   - Add-item modal: name, category dropdown, unit dropdown, par_level number input, optional supplier/cost/notes. On name blur (>3 chars), call `categorizeInventoryItem` and pre-fill category dropdown (keep editable).
   - Adjust modal: item context at top, type selector chips, delta number input (allow ±), optional note, save
   - Edit modal: same fields as add minus name (name is editable in patch but discouraged)
   - Archive button: confirm dialog → call delete → refresh list

3. **Nav** (`components/Layout.js` or wherever the restaurant nav is built)
   - Add "Inventory" entry with package/box icon, between "Waste" and "Reports"

4. **Web tests** (`pages/__tests__/inventory.test.js` — new file, ~5 tests)
   - `renders empty state when no items`
   - `renders populated table with low-stock items first`
   - `add-item form calls categorize on name blur and pre-fills category`
   - `adjust modal posts correct delta and type`
   - `archive removes item from list`

### Mobile (`mobile/`)

5. **API client** (`services/api.js`) — same 6 methods as web

6. **Screen** (`app/(restaurant)/inventory.js`)
   - Header: title + add-FAB
   - Category filter row (horizontal scroll pills)
   - FlatList of items:
     - Each row: name, current/par fraction (e.g. "3 / 6 bottles"), low-stock badge if applicable
     - Tap row → opens **adjust bottom-sheet**
     - Long-press → opens edit/archive menu
   - Empty state: matching copy as web
   - **Adjust bottom-sheet** (the counting-optimized UX):
     - Item name + current quantity displayed large (28pt)
     - Type chips: Delivery / Usage / Waste / Correction (Usage selected by default for - actions, Delivery for +)
     - 2-col grid of big buttons (each ~70pt height with haptic on tap):
       - `+1` `−1`
       - `+ Case (12)` `− Case (12)` — case size derives from `unit` mapping
     - Delta preview shows running delta as buttons are tapped
     - Note input (optional, single-line)
     - Save button at bottom (primary), cancel at top
     - Uses `expo-haptics` for tap feedback (light impact on +1/-1, medium on case actions, success on save)
   - Add-item modal: same form as web, mobile-styled with sectioned card layout
   - Categorize-on-blur in add form

7. **Nav** (`mobile/app/(restaurant)/_layout.js`)
   - Add "Inventory" tab entry to the restaurant tab bar with package icon (Ionicons `cube-outline`)

8. **Case-pack mapping helper** (`mobile/utils/casePacks.js` — small new file)
   - Pure function `casePackFor(unit) -> number`
   - Map: `bottles=12, cases=1, kg=1, lbs=1, each=1, liters=1` (default `1` for unknown)

9. **Mobile tests** (`mobile/app/(restaurant)/__tests__/inventory.test.js` — new file, ~5 tests)
   - `empty state when no items`
   - `populated list with low-stock badges`
   - `quick-adjust bottom sheet +1/-1 buttons compute correct delta`
   - `quick-adjust case buttons compute delta using unit's pack size`
   - `add-item categorize-on-blur populates category dropdown`

## Test Verification

```bash
# Web
cd frontend && npm test -- --testPathPattern=inventory

# Mobile
cd mobile && npx jest app/\(restaurant\)/__tests__/inventory.test.js
```

## Success Criteria

1. ✓ Restaurant operator on web can add an item, see it in the table, log adjustments, see updated current quantity, archive it.
2. ✓ Restaurant operator on mobile can do all of the above, AND the quick-adjust bottom sheet's +/- and case buttons produce correct delta values.
3. ✓ Adding an item with name "Tito's Vodka" on either platform pre-fills category as `alcohol` (when ANTHROPIC_API_KEY set) or `food` (when unset, with form still allowing override).
4. ✓ Low-stock items render with visual emphasis (red/amber border) and sort first.
5. ✓ Both new screens reachable from nav. No existing screens broken.

## Dependencies

- Depends on Plan 1: HTTP endpoints must exist
- Independent of Plan 2: digest job can ship later

## Reports CSV extension (small task, included here for atomicity)

10. **Reports update** (`backend/app/services/reports_service.py` — extend existing)
    - Add inventory items section to the existing CSV export
    - Columns: `inventory_item_id, name, category, unit, current_quantity, par_level, last_30d_usage_quantity, last_30d_waste_quantity, supplier, cost_per_unit`
    - 1 simple test in `test_reports.py` that the new section appears
