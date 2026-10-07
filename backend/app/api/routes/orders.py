"""Live ordering + kitchen display API (restaurant-only).

Server flow: POST /orders (pick table, add items) → POST /orders/{id}/submit
(send to kitchen). Kitchen flow: GET /orders/kitchen (tickets by station) →
POST /orders/items/{item_id}/status (bump new→preparing→ready→served).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


class ItemIn(BaseModel):
    menu_item_id: Optional[int] = None
    name: Optional[str] = None
    quantity: Optional[int] = 1
    unit_price: Optional[float] = None
    station: Optional[str] = None
    notes: Optional[str] = None


class OrderIn(BaseModel):
    table_number: int
    server_name: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list[ItemIn]] = None


class ItemsIn(BaseModel):
    items: list[ItemIn]


class StatusIn(BaseModel):
    status: str


def _specs(items) -> list[dict]:
    return [i.model_dump(exclude_none=True) for i in (items or [])]


@router.post("")
def create_order(body: OrderIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        order = order_service.create_order(
            db, current_user.id, body.table_number,
            server_name=body.server_name, notes=body.notes, items=_specs(body.items),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return order_service.order_dict(db, order)


@router.get("")
def list_orders(status: Optional[str] = None, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return {"orders": order_service.list_orders(db, current_user.id, status=status)}


@router.get("/kitchen")
def kitchen(station: Optional[str] = None, db: Session = Depends(get_db),
            current_user: User = Depends(get_current_user)):
    """Kitchen Display: active tickets grouped by station, longest-waiting first."""
    _require_restaurant(current_user)
    return order_service.kitchen_view(db, current_user.id, station=station)


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        order = order_service._get_owned_order(db, current_user.id, order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return order_service.order_dict(db, order)


@router.post("/{order_id}/items")
def add_items(order_id: int, body: ItemsIn, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        order = order_service.add_items(db, current_user.id, order_id, _specs(body.items))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return order_service.order_dict(db, order)


@router.post("/{order_id}/submit")
def submit_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        order = order_service.submit_order(db, current_user.id, order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return order_service.order_dict(db, order)


@router.post("/{order_id}/close")
def close_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        order = order_service.close_order(db, current_user.id, order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return order_service.order_dict(db, order)


@router.post("/{order_id}/cancel")
def cancel_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        order = order_service.cancel_order(db, current_user.id, order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return order_service.order_dict(db, order)


@router.post("/items/{item_id}/status")
def set_item_status(item_id: int, body: StatusIn, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    try:
        item = order_service.set_item_status(db, current_user.id, item_id, body.status)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return order_service._item_dict(item)
