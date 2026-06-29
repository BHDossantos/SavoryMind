"""Inventory service — business logic for items + ledger.

Tenancy invariant: every public function takes `user_id` and filters every
query by it. Cross-tenancy is the #1 threat for this feature
(THREAT-MODEL.md T1) and the test suite enforces isolation explicitly.

Ledger immutability: there is intentionally NO update_adjustment or
delete_adjustment. To "fix" a wrong delta, log a count_correction with
the difference. The original row stays in the audit trail.
"""
from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.inventory import InventoryItem, InventoryAdjustment, INVENTORY_CATEGORIES
from . import claude_client

import json
import logging

logger = logging.getLogger(__name__)


# ── Item CRUD ────────────────────────────────────────────────────────────


def list_items(db: Session, user_id: int, category: Optional[str] = None) -> list[dict]:
    """List active (non-archived) items for a restaurant. Returns dicts
    with `current_quantity` and `is_low` computed from the ledger."""
    q = db.query(InventoryItem).filter(
        InventoryItem.user_id == user_id,
        InventoryItem.archived_at.is_(None),
    )
    if category is not None:
        if category not in INVENTORY_CATEGORIES:
            raise HTTPException(status_code=422, detail=f"Unknown category: {category}")
        q = q.filter(InventoryItem.category == category)

    items = q.order_by(InventoryItem.name.asc()).all()
    if not items:
        return []

    item_ids = [i.id for i in items]
    current_quantities = compute_current_quantities(db, item_ids)

    out = []
    for item in items:
        cq = current_quantities.get(item.id, 0.0)
        out.append({
            "id":               item.id,
            "name":             item.name,
            "category":         item.category,
            "unit":             item.unit,
            "par_level":        item.par_level,
            "reorder_quantity": item.reorder_quantity,
            "supplier":         item.supplier,
            "cost_per_unit":    item.cost_per_unit,
            "notes":            item.notes,
            "archived_at":      item.archived_at,
            "created_at":       item.created_at,
            "updated_at":       item.updated_at,
            "current_quantity": cq,
            "is_low":           cq < item.par_level,
        })
    return out


def create_item(db: Session, user_id: int, payload: dict) -> InventoryItem:
    item = InventoryItem(user_id=user_id, **payload)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def serialize_item(db: Session, item: InventoryItem) -> dict:
    """Format a single ORM item the same way list_items does, with
    `current_quantity` + `is_low` computed."""
    cq = compute_current_quantity(db, item.id)
    return {
        "id":               item.id,
        "name":             item.name,
        "category":         item.category,
        "unit":             item.unit,
        "par_level":        item.par_level,
        "reorder_quantity": item.reorder_quantity,
        "supplier":         item.supplier,
        "cost_per_unit":    item.cost_per_unit,
        "notes":            item.notes,
        "archived_at":      item.archived_at,
        "created_at":       item.created_at,
        "updated_at":       item.updated_at,
        "current_quantity": cq,
        "is_low":           cq < item.par_level,
    }


def _get_owned_item(db: Session, user_id: int, item_id: int) -> InventoryItem:
    """Fetch an active item the caller owns or raise 404. Single helper to
    keep tenancy + soft-delete invariant in one place."""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.user_id == user_id,
        InventoryItem.archived_at.is_(None),
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found.")
    return item


def update_item(db: Session, user_id: int, item_id: int, patch: dict) -> InventoryItem:
    """Patch mutable fields. category is NOT mutable here (CONTEXT.md);
    the schema layer already excludes it but defense-in-depth: we ignore
    any 'category' key that sneaks through."""
    item = _get_owned_item(db, user_id, item_id)
    for key, value in patch.items():
        if key == "category":
            continue  # not allowed
        if value is not None and hasattr(item, key):
            setattr(item, key, value)
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


def archive_item(db: Session, user_id: int, item_id: int) -> bool:
    item = _get_owned_item(db, user_id, item_id)
    item.archived_at = datetime.utcnow()
    db.commit()
    return True


# ── Ledger ───────────────────────────────────────────────────────────────


def adjust(db: Session, user_id: int, item_id: int, payload: dict) -> InventoryAdjustment:
    """Append a ledger row. Owner check defense-in-depth (FK alone doesn't
    enforce tenancy)."""
    item = _get_owned_item(db, user_id, item_id)
    adj = InventoryAdjustment(
        item_id=item.id,
        user_id=user_id,
        adjustment_type=payload["adjustment_type"],
        delta=payload["delta"],
        note=payload.get("note"),
    )
    db.add(adj)
    db.commit()
    db.refresh(adj)
    return adj


def compute_current_quantities(db: Session, item_ids: list[int]) -> dict[int, float]:
    """Single grouped query → {item_id: current_quantity}. Used by list
    endpoints to avoid N+1."""
    if not item_ids:
        return {}
    rows = (
        db.query(InventoryAdjustment.item_id, func.coalesce(func.sum(InventoryAdjustment.delta), 0.0))
        .filter(InventoryAdjustment.item_id.in_(item_ids))
        .group_by(InventoryAdjustment.item_id)
        .all()
    )
    result = {item_id: 0.0 for item_id in item_ids}
    for item_id, total in rows:
        result[item_id] = float(total or 0.0)
    return result


def compute_current_quantity(db: Session, item_id: int) -> float:
    return compute_current_quantities(db, [item_id]).get(item_id, 0.0)


def get_low_stock_items(db: Session, user_id: int) -> list[dict]:
    """Return items whose current_quantity < par_level. Used by the weekly
    digest job. Same shape as list_items so the digest can render directly."""
    all_items = list_items(db, user_id)
    return [item for item in all_items if item["is_low"]]


# ── Claude categorization ───────────────────────────────────────────────


_CATEGORIZE_SYSTEM = """Classify this restaurant inventory item name into one of:
  alcohol, food, produce, dry_goods, kitchen_supply, cleaning.

Definitions:
- alcohol: wine, beer, spirits, liqueurs, mixers with alcohol
- food: prepared/processed food, meat, dairy, bread, frozen items
- produce: fresh fruits, vegetables, herbs (anything that wilts)
- dry_goods: rice, pasta, flour, sugar, spices, canned goods
- kitchen_supply: utensils, paper goods, takeout containers, foil, gloves
- cleaning: detergent, sanitizer, bleach, mop heads, trash bags

Return JSON: {"category": "<one of the above>", "confidence": <0..1>}.
If unsure, default to "food" with confidence 0.3."""

_CATEGORIZE_SCHEMA = {
    "type": "object",
    "properties": {
        "category":   {"type": "string", "enum": list(INVENTORY_CATEGORIES)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["category", "confidence"],
    "additionalProperties": False,
}


def categorize(name: str) -> dict:
    """Returns {"category": str, "confidence": float}. Falls back to
    food / 0.0 when Claude unavailable or returns garbage — never raises."""
    if not name or not name.strip():
        return {"category": "food", "confidence": 0.0}
    if not claude_client.is_configured():
        return {"category": "food", "confidence": 0.0}

    try:
        result = claude_client.call_json(
            _CATEGORIZE_SYSTEM,
            name,
            _CATEGORIZE_SCHEMA,
            model=claude_client.BATCH_MODEL,
            max_tokens=64,
        )
    except Exception:
        logger.exception("inventory categorize: Claude call raised")
        return {"category": "food", "confidence": 0.0}

    if not result or "category" not in result:
        return {"category": "food", "confidence": 0.0}
    if result["category"] not in INVENTORY_CATEGORIES:
        return {"category": "food", "confidence": 0.0}
    return result
