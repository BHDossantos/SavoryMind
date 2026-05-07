"""Inventory tracking models.

Two tables, one purpose: let restaurants track per-SKU stock with a
tamper-evident audit trail.

  InventoryItem        — the SKU (name, category, par_level, etc.)
  InventoryAdjustment  — append-only ledger row recording every quantity
                         change (delivery / usage / waste / count_correction).

`current_quantity` is intentionally NOT a column on InventoryItem — it's
derived at read time from the ledger so the audit trail is the single
source of truth. If a row says "current quantity = 6 bottles" but the
ledger sums to 4, the ledger wins. See inventory_service.compute_current
_quantity for the read-time aggregation.

To "correct" a wrong adjustment, log a count_correction row with the
delta needed to make the running total right. We do NOT expose
PATCH/DELETE on adjustments — that would defeat the immutability
guarantee that makes this an audit trail rather than just a state
snapshot. Threat model T2 in
.planning/phases/phase-1-restaurant-inventory-tracking/THREAT-MODEL.md.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Index
from ..core.database import Base


# Allowed values — also enforced at the Pydantic schema layer.
INVENTORY_CATEGORIES = (
    "alcohol", "food", "produce", "dry_goods", "kitchen_supply", "cleaning",
)

ADJUSTMENT_TYPES = (
    "delivery", "usage", "waste", "count_correction",
)


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name        = Column(String(120), nullable=False)
    category    = Column(String(20), nullable=False)  # one of INVENTORY_CATEGORIES
    unit        = Column(String(20), nullable=False)
    par_level   = Column(Float, nullable=False, default=0.0)

    reorder_quantity = Column(Float, nullable=True)
    supplier         = Column(String(120), nullable=True)
    cost_per_unit    = Column(Float, nullable=True)
    notes            = Column(Text, nullable=True)

    # Soft-delete sentinel. Lists filter `archived_at IS NULL` by default so
    # archived items don't pollute the dashboard but historical adjustments
    # against them stay queryable.
    archived_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InventoryAdjustment(Base):
    """Append-only ledger row. NEVER expose PATCH/DELETE — see model
    docstring + THREAT-MODEL.md T2."""
    __tablename__ = "inventory_adjustments"

    id              = Column(Integer, primary_key=True, index=True)
    item_id         = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    adjustment_type = Column(String(20), nullable=False)  # one of ADJUSTMENT_TYPES
    delta           = Column(Float, nullable=False)        # can be negative (usage / waste)
    note            = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)


# Composite index for the most common digest query: "items whose ledger
# sum is below par for a given owner". The sum is computed in service code
# but the GROUP BY needs a fast index path.
Index("ix_inventory_adjustments_item_user", InventoryAdjustment.item_id, InventoryAdjustment.user_id)
