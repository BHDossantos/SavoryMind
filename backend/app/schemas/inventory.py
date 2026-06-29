"""Pydantic v2 request/response schemas for inventory."""
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator

from ..models.inventory import INVENTORY_CATEGORIES, ADJUSTMENT_TYPES


CategoryLiteral = Literal["alcohol", "food", "produce", "dry_goods", "kitchen_supply", "cleaning"]
AdjustmentTypeLiteral = Literal["delivery", "usage", "waste", "count_correction"]


class InventoryItemRead(BaseModel):
    id: int
    name: str
    category: str
    unit: str
    par_level: float
    reorder_quantity: Optional[float] = None
    supplier: Optional[str] = None
    cost_per_unit: Optional[float] = None
    notes: Optional[str] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Computed at read time, not stored.
    current_quantity: float = 0.0
    is_low: bool = False

    class Config:
        from_attributes = True


class InventoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: CategoryLiteral
    unit: str = Field(min_length=1, max_length=20)
    par_level: float = Field(ge=0)
    reorder_quantity: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = Field(default=None, max_length=120)
    cost_per_unit: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)


class InventoryUpdate(BaseModel):
    """Patch payload — every field optional. category is intentionally
    excluded; changing category requires create+archive (CONTEXT.md)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=20)
    par_level: Optional[float] = Field(default=None, ge=0)
    reorder_quantity: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = Field(default=None, max_length=120)
    cost_per_unit: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)


class AdjustmentCreate(BaseModel):
    adjustment_type: AdjustmentTypeLiteral
    delta: float
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("delta")
    @classmethod
    def reject_zero_delta(cls, v: float) -> float:
        if v == 0:
            raise ValueError("delta must be non-zero")
        return v


class AdjustmentRead(BaseModel):
    id: int
    item_id: int
    adjustment_type: str
    delta: float
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CategorizeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CategorizeResponse(BaseModel):
    category: CategoryLiteral
    confidence: float = Field(ge=0, le=1)
