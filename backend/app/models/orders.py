"""Live table ordering + kitchen display (KDS).

The operational core the app was missing: a server takes an order at a table
on the phone, it's sent to the kitchen, and each line item is routed to a
station (derived from the menu item's category) where kitchen staff bump it
new → preparing → ready → served. Every item is tied to a table + station, so
it also becomes the data spine for "what table ordered what" and
consumption/waste analytics.

  Order     — one open tab for a table (status: open → submitted → served → closed)
  OrderItem — a single dish/drink line on an order, routed to a station, with
              its own kitchen status so stations work independently.
"""
import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index

from ..core.database import Base

ORDER_STATUSES = ("open", "submitted", "served", "closed", "cancelled")
ITEM_STATUSES = ("new", "preparing", "ready", "served", "cancelled")


class Order(Base):
    """One tab for a table. Stays 'open' while the server adds items, becomes
    'submitted' when sent to the kitchen, 'served' when every item is served,
    and 'closed' when settled."""
    __tablename__ = "orders"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # restaurant
    table_number = Column(Integer, nullable=False, index=True)
    status       = Column(String(20), nullable=False, default="open", server_default="open")
    server_name  = Column(String(120), nullable=True)   # who took it (free text or staff name)
    notes        = Column(String(500), nullable=True)
    created_at   = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    updated_at   = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    closed_at    = Column(DateTime, nullable=True)


class OrderItem(Base):
    """A single line on an order. `station` (routed from the menu item's
    category) decides which kitchen station sees it; `status` tracks it there."""
    __tablename__ = "order_items"

    id            = Column(Integer, primary_key=True, index=True)
    order_id      = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # denorm for tenant-scoped KDS queries
    menu_item_id  = Column(Integer, ForeignKey("menu_items.id"), nullable=True)           # nullable: ad-hoc items allowed
    name          = Column(String(200), nullable=False)   # snapshot — survives menu edits
    quantity      = Column(Integer, nullable=False, default=1, server_default="1")
    unit_price    = Column(Float, nullable=True)          # snapshot at order time
    station       = Column(String(60), nullable=False, default="cucina", server_default="cucina", index=True)
    status        = Column(String(20), nullable=False, default="new", server_default="new")
    notes         = Column(String(300), nullable=True)    # "senza glutine", "ben cotto", …
    created_at    = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


# KDS hot path: open items for a restaurant, optionally by station.
Index("ix_order_items_user_status", OrderItem.user_id, OrderItem.status)
