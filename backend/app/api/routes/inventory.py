"""Inventory endpoints — restaurant operators only.

Public surface (auth = restaurant user):
  GET    /api/inventory                      list items (filterable by category)
  POST   /api/inventory                      create item
  PATCH  /api/inventory/{id}                 update item (not category)
  DELETE /api/inventory/{id}                 soft-archive item
  POST   /api/inventory/{id}/adjust          append ledger row
  POST   /api/inventory/categorize           Claude category suggestion

Internal surface (auth = OIDC service account):
  POST   /internal/jobs/inventory-digest     weekly low-stock digest trigger

The internal endpoint is intentionally on a different prefix so it never
gets mounted under /api in front-end clients. Cloud Scheduler is the only
caller.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.rate_limit import limiter
from ...core.security import get_current_user
from ...models.user import User
from ...services import inventory_service
from ...schemas.inventory import (
    InventoryCreate, InventoryUpdate, InventoryItemRead,
    AdjustmentCreate, AdjustmentRead,
    CategorizeRequest, CategorizeResponse,
)


router = APIRouter(prefix="/inventory", tags=["inventory"])


def require_restaurant(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant accounts only.",
        )
    return user


@router.get("")
@limiter.limit("60/minute")
def list_inventory(
    request: Request,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_restaurant),
):
    return inventory_service.list_items(db, user.id, category=category)


@router.post("", status_code=201)
@limiter.limit("60/minute")
def create_inventory(
    request: Request,
    body: InventoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_restaurant),
):
    item = inventory_service.create_item(db, user.id, body.model_dump())
    return inventory_service.serialize_item(db, item)


@router.patch("/{item_id}")
@limiter.limit("60/minute")
def update_inventory(
    request: Request,
    item_id: int,
    body: InventoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_restaurant),
):
    # `exclude_unset=True` so we only overwrite fields the caller explicitly set.
    patch = body.model_dump(exclude_unset=True)
    item = inventory_service.update_item(db, user.id, item_id, patch)
    return inventory_service.serialize_item(db, item)


@router.delete("/{item_id}", status_code=204)
@limiter.limit("60/minute")
def archive_inventory(
    request: Request,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_restaurant),
):
    inventory_service.archive_item(db, user.id, item_id)
    return None


@router.post("/{item_id}/adjust", status_code=201)
@limiter.limit("120/minute")  # higher — counting bursts during stocktake
def adjust_inventory(
    request: Request,
    item_id: int,
    body: AdjustmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_restaurant),
):
    adj = inventory_service.adjust(db, user.id, item_id, body.model_dump())
    return AdjustmentRead.model_validate(adj)


@router.post("/categorize")
@limiter.limit("30/minute")  # Claude calls — protect the budget
def categorize_inventory(
    request: Request,
    body: CategorizeRequest,
    user: User = Depends(require_restaurant),
):
    """Claude category suggestion — UI hint only. Never returns a category
    the schema doesn't allow; never raises on Claude failure."""
    result = inventory_service.categorize(body.name)
    return CategorizeResponse.model_validate(result)
