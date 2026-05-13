# Phase 1: Restaurant Inventory Tracking — CONTEXT

**Phase number:** 1
**Goal (from ROADMAP.md):** Restaurant operators can track every SKU via an append-only adjustment ledger, get a once-weekly low-stock digest, and add new items with Claude auto-categorizing from the name. Web + mobile parity required at ship.
**Requirements:** INV-01..08

This document locks every gray-area decision so the 3 plans below execute without re-litigating them.

## Phase Boundary

**In scope:**
- New SQLAlchemy models: `InventoryItem`, `InventoryAdjustment`
- One Alembic migration adding both tables + a `users.timezone` column
- ~6 backend endpoints under `/api/inventory/*` (create / list / patch / archive / adjust / categorize)
- Weekly digest job: Cloud Scheduler → backend `/internal/jobs/inventory-digest` endpoint, OIDC-authenticated
- Reports CSV export: extend existing report to include inventory ledger
- Web page: `frontend/src/pages/restaurant/inventory.js`
- Mobile screen: `mobile/app/(restaurant)/inventory.js`
- Restaurant nav entry on both web (`Layout.js`) and mobile (`(restaurant)/_layout.js`)
- ~25 new tests across the three layers

**Out of scope (explicit, deferred to v2 or later):**
- Barcode scanning
- Supplier ordering integration / EDI
- Multi-location inventory
- Recipe → ingredient mapping + auto-decrement on menu sales
- Anomaly detection ("3× normal usage")
- Par-level AI suggestions from history
- Real-time push notifications for low-stock
- Receipt OCR for delivery logging

## Implementation Decisions

### Routing + module layout
- **New module:** `backend/app/api/routes/inventory.py` (don't bloat `owner_extras.py` further — that file is already touching 4 features)
- **New service:** `backend/app/services/inventory_service.py` (keep route handlers thin)
- **New schemas:** `backend/app/schemas/inventory.py` (Pydantic v2)
- **Models live at:** `backend/app/models/inventory.py` (single file for both `InventoryItem` and `InventoryAdjustment`)
- **Mount in main.py:** `app.include_router(inventory.router, prefix="/api")` after the `notifications.router` line

### Schema design — `InventoryItem`

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | Integer PK | autoincr | row identity |
| `user_id` | Integer FK→users.id | NOT NULL, indexed | restaurant owner; tenancy scope |
| `name` | String(120) | NOT NULL | display name ("Tito's Vodka 1.75L") |
| `category` | String(20) | NOT NULL, CHECK in {alcohol, food, produce, dry_goods, kitchen_supply, cleaning} | filter + reporting axis |
| `unit` | String(20) | NOT NULL, free text but suggested {bottles, kg, cases, each, liters, lbs} | display + report grouping |
| `par_level` | Float | NOT NULL, ≥0 | warn-below threshold |
| `reorder_quantity` | Float | nullable | suggested order amount when below par |
| `supplier` | String(120) | nullable | free-text supplier name |
| `cost_per_unit` | Float | nullable | for waste-cost calculations |
| `notes` | Text | nullable | free-text |
| `archived_at` | DateTime | nullable | soft-delete sentinel |
| `created_at` | DateTime | default `utcnow` | audit |
| `updated_at` | DateTime | default `utcnow` on update | audit |

**No `current_quantity` column.** Computed at read time from the ledger (see below).

### Schema design — `InventoryAdjustment`

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | Integer PK | autoincr | identity |
| `item_id` | Integer FK→inventory_items.id | NOT NULL, indexed | which SKU |
| `user_id` | Integer FK→users.id | NOT NULL, indexed | who logged it (defense-in-depth — must match `item.user_id`) |
| `adjustment_type` | String(20) | NOT NULL, CHECK in {delivery, usage, waste, count_correction} | semantic kind |
| `delta` | Float | NOT NULL, can be negative | actual quantity change (`+24`, `-3`) |
| `note` | Text | nullable | "Sysco delivery #12345" or "broke 2 bottles" |
| `created_at` | DateTime | default `utcnow`, indexed | for time-window queries + digest |

**Append-only.** No PATCH or DELETE endpoint exposed. To correct a mistaken adjustment, log a `count_correction` with the delta needed to make the running total right.

### Schema migration — `users.timezone`

- Add column `timezone VARCHAR(64) NOT NULL DEFAULT 'UTC'` (IANA TZ database name, e.g. `America/New_York`)
- Migration is additive + non-breaking
- Profile endpoint (`PATCH /api/auth/profile`) gets `timezone` added to the allowlist so restaurants can change it
- Default `UTC` is safe — digest still fires on Monday, just at 8am UTC for unset restaurants. Operators can update via profile.

### Computing `current_quantity`

Defined in `inventory_service.compute_current_quantity(db, item_id) -> float`:

```python
result = db.query(func.coalesce(func.sum(InventoryAdjustment.delta), 0.0))\
           .filter(InventoryAdjustment.item_id == item_id)\
           .scalar()
return float(result)
```

For list endpoints, compute in a single grouped query to avoid N+1:

```python
sums = dict(db.query(InventoryAdjustment.item_id, func.coalesce(func.sum(InventoryAdjustment.delta), 0.0))\
              .filter(InventoryAdjustment.item_id.in_(item_ids))\
              .group_by(InventoryAdjustment.item_id).all())
```

If perf ever becomes an issue at >10k items per restaurant: add a `current_quantity` denormalized column maintained by a database trigger on `inventory_adjustments` insert. Not v1.

### Endpoint surface

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/inventory` | list items (with computed `current_quantity` + `is_low` boolean), filter by `?category=...` | restaurant only |
| `POST` | `/api/inventory` | create item | restaurant only |
| `PATCH` | `/api/inventory/{id}` | update name/par/reorder/supplier/cost/notes (NOT category — category change requires create+archive) | restaurant only, owner check |
| `DELETE` | `/api/inventory/{id}` | soft-delete (set `archived_at`) | restaurant only, owner check |
| `POST` | `/api/inventory/{id}/adjust` | log adjustment (delta, type, note) | restaurant only, owner check |
| `POST` | `/api/inventory/categorize` | Claude categorize from name only | restaurant only |
| `POST` | `/internal/jobs/inventory-digest` | weekly digest trigger | OIDC service-account only |

**Deliberately no:**
- `GET /api/inventory/{id}` (list returns all data; one-row fetch is wasted complexity)
- `GET /api/inventory/{id}/adjustments` (defer until usage history UI is built — v2)

### Claude auto-categorize — `POST /api/inventory/categorize`

Body: `{"name": "Tito's Handmade Vodka 1.75L"}`
Response: `{"category": "alcohol", "confidence": 0.95}`

Implementation in `inventory_service.categorize(name)`:

```python
SYSTEM = """Classify this inventory item name into one of:
  alcohol, food, produce, dry_goods, kitchen_supply, cleaning.

Return JSON: {"category": "<one of the above>", "confidence": <0..1>}.
If unsure, default to "food" with confidence 0.3."""

SCHEMA = {
  "type": "object",
  "properties": {
    "category": {"type": "string", "enum": ["alcohol","food","produce","dry_goods","kitchen_supply","cleaning"]},
    "confidence": {"type": "number", "minimum": 0, "maximum": 1}
  },
  "required": ["category","confidence"],
  "additionalProperties": False
}

result = claude_client.call_json(SYSTEM, name, SCHEMA, model=claude_client.BATCH_MODEL, max_tokens=64)
if result is None:
    return {"category": "food", "confidence": 0.0}  # rules-based fallback
return result
```

Uses Haiku (cheap, fast — perfect for short classification). Fallback when `ANTHROPIC_API_KEY` unset returns `food / 0.0` so UI still shows a default and user can override. Prompt caching not needed (each call is unique input).

### Weekly digest — Cloud Scheduler approach

**Cron expression:** `0 * * * 1` (every hour on Monday, UTC). Backend filters to restaurants where it's currently 8am-9am in their local timezone.

Why hourly instead of `0 8 * * 1`: timezones span 24 hours; restaurants in `Pacific/Auckland` get Monday 8am 16+ hours before restaurants in `America/Los_Angeles`. Single global trigger at 8am UTC misses everyone.

**Endpoint:** `POST /internal/jobs/inventory-digest`
- Auth: validate `Authorization: Bearer <token>` is an OIDC token issued for the scheduler service-account audience
- Logic:
  1. Now in UTC. For each restaurant, compute their local hour. Pick those where local hour == 8 AND local weekday == Monday.
  2. For each picked restaurant, query items where `current_quantity < par_level` AND `archived_at IS NULL`.
  3. Idempotent insert of `Notification` row keyed on `(user_id, link='/restaurant/inventory', message starts with "Weekly inventory digest:")` for the current ISO week. If exists, UPDATE message + reset `read=False`. Else INSERT.
  4. If `RESEND_API_KEY` set: send one email per restaurant with the same content. If unset: skip silently.
  5. Return `{"restaurants_processed": N, "notifications_created": M, "emails_sent": K}`.

**Idempotency:** the digest is allowed to run multiple times in the same hour (Cloud Scheduler retries on 5xx). The `(user_id, week_start_date)` dedup prevents double notifications.

**Cloud Scheduler creation** (run once during deploy of this phase):
```sh
gcloud scheduler jobs create http inventory-weekly-digest \
  --location=us-central1 \
  --schedule="0 * * * 1" \
  --time-zone="UTC" \
  --uri="https://api.savorymind.net/internal/jobs/inventory-digest" \
  --oidc-service-account-email=scheduler-runner@<project>.iam.gserviceaccount.com \
  --oidc-token-audience="https://api.savorymind.net/internal/jobs/inventory-digest"
```

The service account `scheduler-runner@...` needs `roles/run.invoker` on the backend Cloud Run service.

### Reports CSV export

Extend `backend/app/api/routes/reports.py` (existing module) with a section for inventory items + recent adjustments. Columns: `item_id, name, category, unit, current_quantity, par_level, last_30d_usage, last_30d_waste`. Single sheet, appended after existing waste/sales sections.

### Web UI — `frontend/src/pages/restaurant/inventory.js`

- Layout: same Tailwind shell as `restaurant/waste.js` (existing pattern). Header + filter row + table + add-item button → modal.
- Table columns: Name | Category badge | Unit | Current | Par | Status (✓ ok / ⚠ low) | Actions (Adjust, Edit, Archive)
- Sort: low-stock items first, then alphabetical
- Filter: category multi-select pills
- "Adjust" action opens a modal with type selector (delivery/usage/waste/correction), delta input (±), optional note
- "Add item" form: name input → on blur, calls `/api/inventory/categorize` and pre-fills category dropdown (still editable)
- Empty state: "No inventory items yet. Add your first one to start tracking." + button

### Mobile UI — `mobile/app/(restaurant)/inventory.js`

- Layout: matches `restaurant/employees.js` structural pattern (FlatList + add-FAB + modal).
- **Counting-optimized adjust UI:** dedicated bottom-sheet modal with:
  - Item name + current value at top, large
  - Big buttons in 2 columns: `+1`, `-1`, `+ Case (12)`, `- Case (12)` — case size derives from `unit` (`bottles` → 12, `cases` → 1, `kg` → 1)
  - Type chips: Delivery / Usage / Waste / Correction (Usage default for `-` actions, Delivery for `+`)
  - Save button at bottom; haptic feedback on tap
- Item rows show low-stock badge (`⚠ Low`) inline
- Same categorize-on-blur in add-item form

### Tests (~25 total)

Backend (~14):
- `test_inventory.py`: create/list/patch/archive happy paths × 4
- Permission scoping: consumer/diner/staff get 403 × 1
- Cross-tenancy: user A can't read/patch/archive user B's items × 3
- Adjustment ledger immutability: PATCH/DELETE return 405 × 2
- `current_quantity` derivation correctness (mixed deliveries/usage/waste/correction) × 1
- Categorize endpoint with key set, key unset, Claude returns garbage × 3

Web (~5):
- Inventory page renders empty state × 1
- Renders populated table with low-stock first × 1
- Add-item flow calls categorize on blur × 1
- Adjust modal records correct delta × 1
- Archive removes from list × 1

Mobile (~5):
- Inventory screen renders empty state × 1
- Renders populated list with low-stock badges × 1
- Quick-adjust modal +/- and case buttons compute correct delta × 1
- Add-item categorize-on-blur × 1
- Archive flow × 1

Digest job (~3, in `test_inventory_digest.py`):
- Items below par produce notification + (if RESEND set) email × 1
- Items at par produce nothing × 1
- Re-run in same hour is idempotent (no double-notify) × 1

### Canonical References

| Topic | Link |
|---|---|
| Existing restaurant route module pattern | `backend/app/api/routes/owner_extras.py` |
| Existing service module pattern | `backend/app/services/waste_service.py` |
| Existing model with audit columns | `backend/app/models/kitchen.py` |
| Notification model | `backend/app/models/notification.py` |
| Existing migration pattern | `backend/alembic/versions/d655b6eb282c_*.py` |
| Cron auth pattern (OIDC) | New — first cron in this codebase. Reference: https://cloud.google.com/run/docs/triggering/using-scheduler |
| Claude client wrapper | `backend/app/services/claude_client.py` (`call_json`, `BATCH_MODEL`) |
| Existing web restaurant page | `frontend/src/pages/restaurant/waste.js` |
| Existing mobile restaurant screen | `mobile/app/(restaurant)/employees.js` |
| Restaurant auth gate | `backend/app/api/routes/owner_extras.py:require_restaurant` |

## Specific Ideas

- **Case-pack mapping** in mobile quick-adjust: derive from `unit`. Defaults: `bottles=12, cases=1, kg=1, each=1, liters=1, lbs=1`. Future: per-item `case_size` column. Not v1.
- **Low-stock badge color** in UI: red border + amber fill (matches existing notification urgency convention from `notifications.js`).
- **Reports CSV** can stay flat for now (one row per item per category). Pivot views are a v2 ask.

## Deferred Ideas

- Per-item usage history graph (item detail page) — v2
- Receipt OCR for delivery logging — v3
- Multi-supplier per-item — v2
- Recurring delivery schedules — v2
- Inventory transfer between locations — v3 (multi-location)
- "Suggested reorder" basket built from items below par — v2

---
*Phase 1 CONTEXT locked: 2026-05-07 via `/gsd-plan-phase 1` (no discuss-phase used — context was pre-loaded)*
