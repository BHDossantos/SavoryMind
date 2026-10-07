"""Order + kitchen-display service.

Stations are routed from the menu item's category (so a "Insalate" item lands
at the salad station a server like Joseph works). Ad-hoc items with no menu
match default to the generic "cucina" station. Everything is tenant-scoped by
user_id and guards the order/item belongs to the caller.
"""
from __future__ import annotations

import datetime

from sqlalchemy.orm import Session

from ..models.menu import MenuItem
from ..models.orders import Order, OrderItem, ITEM_STATUSES

_ACTIVE_ITEM = ("new", "preparing", "ready")          # still relevant to the kitchen
_ACTIVE_ORDER = ("open", "submitted", "served")       # not yet closed/cancelled


def _station_for(category: str | None) -> str:
    c = (category or "").strip().lower()
    return c or "cucina"


def _resolve_item(db: Session, user_id: int, spec: dict) -> OrderItem:
    """Build an OrderItem from a spec: {menu_item_id?, name?, quantity?, notes?}.
    A menu_item_id snapshots name/price/station from the menu; otherwise the
    caller must supply a name (ad-hoc item)."""
    qty = int(spec.get("quantity") or 1)
    if qty < 1:
        qty = 1
    notes = (spec.get("notes") or None)
    mid = spec.get("menu_item_id")
    if mid:
        mi = db.query(MenuItem).filter(MenuItem.id == mid, MenuItem.user_id == user_id).first()
        if not mi:
            raise ValueError(f"Menu item {mid} not found.")
        return OrderItem(user_id=user_id, menu_item_id=mi.id, name=mi.name,
                         quantity=qty, unit_price=mi.price, station=_station_for(mi.category),
                         notes=notes, status="new")
    name = (spec.get("name") or "").strip()
    if not name:
        raise ValueError("Each item needs a menu_item_id or a name.")
    return OrderItem(user_id=user_id, menu_item_id=None, name=name, quantity=qty,
                     unit_price=spec.get("unit_price"), station=_station_for(spec.get("station")),
                     notes=notes, status="new")


def create_order(db: Session, user_id: int, table_number: int, *, server_name=None,
                 notes=None, items: list[dict] | None = None) -> Order:
    order = Order(user_id=user_id, table_number=int(table_number), status="open",
                  server_name=(server_name or None), notes=(notes or None))
    db.add(order)
    db.flush()  # get order.id
    for spec in (items or []):
        it = _resolve_item(db, user_id, spec)
        it.order_id = order.id
        db.add(it)
    db.commit()
    db.refresh(order)
    return order


def _get_owned_order(db: Session, user_id: int, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user_id).first()
    if not order:
        raise ValueError("Order not found.")
    return order


def add_items(db: Session, user_id: int, order_id: int, items: list[dict]) -> Order:
    order = _get_owned_order(db, user_id, order_id)
    if order.status in ("closed", "cancelled"):
        raise ValueError(f"Cannot add items to a {order.status} order.")
    for spec in items:
        it = _resolve_item(db, user_id, spec)
        it.order_id = order.id
        db.add(it)
    order.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


def submit_order(db: Session, user_id: int, order_id: int) -> Order:
    order = _get_owned_order(db, user_id, order_id)
    if order.status == "open":
        order.status = "submitted"
        order.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(order)
    return order


def set_item_status(db: Session, user_id: int, item_id: int, status: str) -> OrderItem:
    if status not in ITEM_STATUSES:
        raise ValueError(f"Invalid item status '{status}'.")
    item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.user_id == user_id).first()
    if not item:
        raise ValueError("Order item not found.")
    item.status = status
    item.updated_at = datetime.datetime.utcnow()
    # If the order is now fully served (every non-cancelled item served), mark it served.
    order = db.query(Order).filter(Order.id == item.order_id).first()
    if order and order.status in ("open", "submitted"):
        siblings = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        live = [s for s in siblings if s.status != "cancelled"]
        if live and all(s.status == "served" for s in live):
            order.status = "served"
            order.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


def close_order(db: Session, user_id: int, order_id: int) -> Order:
    order = _get_owned_order(db, user_id, order_id)
    order.status = "closed"
    order.closed_at = datetime.datetime.utcnow()
    order.updated_at = order.closed_at
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, user_id: int, order_id: int) -> Order:
    order = _get_owned_order(db, user_id, order_id)
    order.status = "cancelled"
    order.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


def _item_dict(it: OrderItem) -> dict:
    return {
        "id": it.id, "order_id": it.order_id, "menu_item_id": it.menu_item_id,
        "name": it.name, "quantity": it.quantity, "unit_price": it.unit_price,
        "station": it.station, "status": it.status, "notes": it.notes,
        "created_at": it.created_at.isoformat() if it.created_at else None,
    }


def order_dict(db: Session, order: Order) -> dict:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).order_by(OrderItem.id).all()
    total = sum((i.unit_price or 0) * i.quantity for i in items if i.status != "cancelled")
    return {
        "id": order.id, "table_number": order.table_number, "status": order.status,
        "server_name": order.server_name, "notes": order.notes,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "closed_at": order.closed_at.isoformat() if order.closed_at else None,
        "items": [_item_dict(i) for i in items],
        "item_count": sum(i.quantity for i in items if i.status != "cancelled"),
        "line_count": len([i for i in items if i.status != "cancelled"]),
        "total": round(total, 2),
    }


def list_orders(db: Session, user_id: int, status: str | None = None) -> list[dict]:
    q = db.query(Order).filter(Order.user_id == user_id)
    if status:
        q = q.filter(Order.status == status)
    else:
        q = q.filter(Order.status.in_(_ACTIVE_ORDER))
    orders = q.order_by(Order.created_at.desc()).all()
    return [order_dict(db, o) for o in orders]


def kitchen_view(db: Session, user_id: int, station: str | None = None) -> dict:
    """Live KDS: active items on submitted/served orders, grouped by station,
    oldest first (longest-waiting on top), each with its table and age."""
    q = (db.query(OrderItem, Order)
         .join(Order, Order.id == OrderItem.order_id)
         .filter(OrderItem.user_id == user_id,
                 OrderItem.status.in_(_ACTIVE_ITEM),
                 Order.status.in_(("submitted", "served")))
         .order_by(OrderItem.created_at.asc()))
    if station:
        q = q.filter(OrderItem.station == station.strip().lower())
    now = datetime.datetime.utcnow()
    by_station: dict[str, list] = {}
    for it, order in q.all():
        age = int((now - it.created_at).total_seconds() // 60) if it.created_at else 0
        by_station.setdefault(it.station, []).append({
            **_item_dict(it),
            "table_number": order.table_number,
            "age_minutes": age,
        })
    return {
        "stations": [{"station": s, "items": its} for s, its in sorted(by_station.items())],
        "total_active": sum(len(v) for v in by_station.values()),
    }
