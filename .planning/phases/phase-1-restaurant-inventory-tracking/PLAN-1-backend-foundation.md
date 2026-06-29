# Plan 1: Backend Foundation

**Phase:** 1 — Restaurant Inventory Tracking
**Goal:** Stand up the database schema, ORM models, service layer, route module, and request schemas so the inventory feature has a solid backend before any UI work starts.
**Estimated commits:** 1 atomic
**Estimated tests added:** ~14

## Tasks

1. **Models** (`backend/app/models/inventory.py`)
   - `InventoryItem` per CONTEXT schema
   - `InventoryAdjustment` per CONTEXT schema
   - Both registered in `backend/app/models/__init__.py` (or add explicit imports in `main.py` like the existing `from app.models.consumer import ...`)

2. **Schemas** (`backend/app/schemas/inventory.py`)
   - `InventoryCreate`, `InventoryUpdate`, `InventoryItemRead` (Pydantic v2)
   - `AdjustmentCreate`, `AdjustmentRead`
   - `CategorizeRequest`, `CategorizeResponse`
   - Validators on `category` enum, `unit` allowed list (warn-don't-block on free text), `delta != 0`

3. **Service** (`backend/app/services/inventory_service.py`)
   - `list_items(db, user_id, category=None) -> list[dict]` — joins computed `current_quantity` and `is_low` derived field
   - `create_item(db, user_id, payload) -> Item`
   - `update_item(db, user_id, item_id, patch) -> Item` — owner check, raise 404 if archived or wrong owner
   - `archive_item(db, user_id, item_id) -> bool` — soft delete
   - `adjust(db, user_id, item_id, payload) -> Adjustment` — owner check; insert ledger row
   - `compute_current_quantity(db, item_ids: list[int]) -> dict[int, float]` — single grouped query for list endpoints
   - `categorize(name) -> dict` — Claude wrapper with rules-based fallback
   - `get_low_stock_items(db, user_id) -> list[Item]` — used by digest job

4. **Routes** (`backend/app/api/routes/inventory.py`)
   - `require_restaurant` gate (copy pattern from `owner_extras.py`)
   - 7 endpoints per CONTEXT table
   - All endpoints rate-limited via existing slowapi `@limiter.limit("60/minute")` pattern

5. **Mount** (`backend/main.py`)
   - Add `from app.api.routes import inventory` to imports
   - Add `app.include_router(inventory.router, prefix="/api")` after the notifications line

6. **Migration** (`backend/alembic/versions/<hash>_add_inventory_tables.py`)
   - Create `inventory_items` table
   - Create `inventory_adjustments` table
   - Add `users.timezone` column (`String(64) NOT NULL DEFAULT 'UTC'`)
   - Indexes: `inventory_items.user_id`, `inventory_adjustments.item_id`, `inventory_adjustments.user_id`, `inventory_adjustments.created_at`
   - Down migration drops in reverse

7. **Profile timezone allowlist** — add `timezone` to the allowlist in `auth.profile_update` (whatever pattern is used to gate which fields can be PATCHed)

8. **Tests** (`backend/tests/test_inventory.py` — new file, ~14 tests)
   - `test_create_item` — happy path
   - `test_create_item_requires_restaurant_account` — consumer/diner/staff get 403
   - `test_list_items_filters_by_owner` — user A can't see user B's items
   - `test_list_items_filters_by_category`
   - `test_list_items_includes_computed_current_quantity`
   - `test_patch_item_owner_only` — user A can't patch user B's
   - `test_patch_item_cannot_change_category` — explicit reject
   - `test_archive_item_soft_deletes`
   - `test_archive_item_owner_only`
   - `test_adjust_item_creates_ledger_row`
   - `test_adjust_item_owner_only`
   - `test_current_quantity_derives_from_ledger_correctly` — mixed delivery/usage/waste/correction
   - `test_categorize_with_claude_unavailable_returns_food_default`
   - `test_categorize_with_claude_returns_valid_category` — patch claude_client

## Test Verification

```bash
cd backend
pytest tests/test_inventory.py -v          # 14 new tests pass
pytest                                      # full 79 + 14 = 93 backend tests pass
```

## Success Criteria

1. ✓ `/api/inventory` endpoints all behave per CONTEXT spec
2. ✓ Cross-tenancy isolation verified (user A cannot affect user B's items via any endpoint)
3. ✓ Adjustment ledger immutable (no PATCH/DELETE exposed)
4. ✓ Migration runs forward + backward cleanly on SQLite (CI) and Postgres (manual verify post-deploy)
5. ✓ All 14 new tests pass + zero regressions on existing 79

## Dependencies

- Plan 1 has no dependencies on other plans. Standalone.
- Plan 2 (digest job) depends on this plan's `get_low_stock_items` service function.
- Plan 3 (web + mobile UIs) depends on this plan's HTTP endpoints existing.
