"""Square POS integration.

Turns SavoryMind from "impressive demo" into "system of record": a sync
pulls the merchant's catalog into menu_items and their recent orders into
sales_logs + menu_items.orders_last_30_days, so the dashboard, menu AI,
and forecaster all run on real transaction data instead of hand-entered
numbers.

Design mirrors spotify_service: a signed `state` JWT carries the user id
through the OAuth redirect, tokens are Fernet-encrypted at rest, and the
whole thing no-ops with is_configured()=False when SQUARE_* env is unset.

The HTTP layer is a module-level indirection (`_http_get` / `_http_post`)
so tests can monkeypatch it and exercise the sync logic without a live
Square account.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.menu import MenuItem
from ..models.pos import POSConnection
from ..models.restaurant_ext import SalesLog

logger = logging.getLogger(__name__)

_STATE_TTL_SECONDS = 600
_STATE_TYP = "square_oauth_state"


def _base_url() -> str:
    return (
        "https://connect.squareupsandbox.com"
        if (settings.square_environment or "sandbox").lower() != "production"
        else "https://connect.squareup.com"
    )


def is_configured() -> bool:
    return bool(settings.square_app_id and settings.square_app_secret)


# --- OAuth state (signed, like spotify_service) -----------------------------

def _sign_state(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id), "typ": _STATE_TYP,
        "iat": now, "exp": now + timedelta(seconds=_STATE_TTL_SECONDS),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def verify_state(state: str) -> int:
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
    except Exception as exc:
        raise ValueError(f"invalid state: {type(exc).__name__}")
    if payload.get("typ") != _STATE_TYP:
        raise ValueError("wrong state type")
    return int(payload["sub"])


def build_authorize_url(user_id: int) -> str:
    from urllib.parse import urlencode
    params = {
        "client_id": settings.square_app_id,
        "scope": "MERCHANT_PROFILE_READ ITEMS_READ ORDERS_READ PAYMENTS_READ",
        "session": "false",
        "state": _sign_state(user_id),
        "redirect_uri": settings.square_redirect_uri,
    }
    return f"{_base_url()}/oauth2/authorize?{urlencode(params)}"


# --- HTTP layer (monkeypatchable in tests) ----------------------------------

def _http_post(url: str, body: dict, *, token: str | None = None) -> dict:
    from urllib.request import Request, urlopen
    headers = {
        "Content-Type": "application/json",
        "Square-Version": settings.square_api_version,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _http_get(url: str, *, token: str) -> dict:
    from urllib.request import Request, urlopen
    headers = {
        "Authorization": f"Bearer {token}",
        "Square-Version": settings.square_api_version,
    }
    req = Request(url, headers=headers, method="GET")
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


# --- Token exchange / refresh -----------------------------------------------

def exchange_code(code: str) -> dict:
    return _http_post(f"{_base_url()}/oauth2/token", {
        "client_id": settings.square_app_id,
        "client_secret": settings.square_app_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.square_redirect_uri,
    })


def refresh_token(refresh: str) -> dict:
    return _http_post(f"{_base_url()}/oauth2/token", {
        "client_id": settings.square_app_id,
        "client_secret": settings.square_app_secret,
        "refresh_token": refresh,
        "grant_type": "refresh_token",
    })


# --- Connection persistence -------------------------------------------------

def _get_connection(db: Session, user_id: int) -> Optional[POSConnection]:
    return db.query(POSConnection).filter(
        POSConnection.user_id == user_id, POSConnection.provider == "square",
    ).first()


def save_connection(db: Session, user_id: int, token_response: dict) -> POSConnection:
    conn = _get_connection(db, user_id) or POSConnection(user_id=user_id, provider="square")
    conn.access_token = token_response.get("access_token")
    conn.refresh_token = token_response.get("refresh_token")
    conn.merchant_id = token_response.get("merchant_id")
    exp = token_response.get("expires_at")
    if exp:
        try:
            conn.token_expires_at = datetime.fromisoformat(exp.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            conn.token_expires_at = None
    conn.connected = bool(conn.access_token)
    if conn.id is None:
        db.add(conn)
    db.commit(); db.refresh(conn)
    return conn


def status(db: Session, user_id: int) -> dict:
    conn = _get_connection(db, user_id)
    return {
        "configured": is_configured(),
        "connected": bool(conn and conn.connected),
        "merchant_name": conn.merchant_name if conn else None,
        "last_synced_at": conn.last_synced_at.isoformat() if conn and conn.last_synced_at else None,
        "last_sync_stats": json.loads(conn.last_sync_stats) if conn and conn.last_sync_stats else None,
    }


def disconnect(db: Session, user_id: int) -> None:
    conn = _get_connection(db, user_id)
    if conn:
        conn.connected = False
        conn.access_token = None
        conn.refresh_token = None
        db.commit()


def _valid_token(db: Session, conn: POSConnection) -> Optional[str]:
    """Return a usable access token, refreshing if near expiry."""
    if conn.token_expires_at and conn.token_expires_at <= datetime.utcnow() + timedelta(minutes=5):
        if conn.refresh_token:
            try:
                resp = refresh_token(conn.refresh_token)
                save_connection(db, conn.user_id, resp)
                conn = _get_connection(db, conn.user_id)
            except Exception:
                logger.warning("square: token refresh failed")
                return None
    return conn.access_token


# --- Sync -------------------------------------------------------------------

def sync(db: Session, user_id: int) -> dict:
    """Pull catalog → menu_items and recent orders → sales_logs +
    orders_last_30_days. Returns a stats dict. Raises ValueError on a
    disconnected/unconfigured connection so the caller can 4xx cleanly."""
    if not is_configured():
        raise ValueError("Square is not configured on this server.")
    conn = _get_connection(db, user_id)
    if not conn or not conn.connected:
        raise ValueError("Square is not connected.")
    token = _valid_token(db, conn)
    if not token:
        raise ValueError("Square token unavailable — reconnect required.")

    # 1) Merchant name (nice-to-have, non-fatal).
    try:
        me = _http_get(f"{_base_url()}/v2/merchants/{conn.merchant_id or 'me'}", token=token)
        merchants = me.get("merchant") or (me.get("merchants") or [{}])
        m = merchants[0] if isinstance(merchants, list) else merchants
        conn.merchant_name = (m or {}).get("business_name") or conn.merchant_name
    except Exception:
        pass

    # 2) Catalog → menu_items (upsert by name).
    items_synced = _sync_catalog(db, user_id, token)

    # 3) Orders (last 30 days) → sales_logs + per-item order counts.
    orders_synced, revenue, per_item = _sync_orders(db, user_id, token)
    _apply_order_counts(db, user_id, per_item)

    stats = {
        "items": items_synced,
        "orders": orders_synced,
        "revenue": round(revenue, 2),
        "synced_at": datetime.utcnow().isoformat(),
    }
    conn.last_synced_at = datetime.utcnow()
    conn.last_sync_stats = json.dumps(stats)
    db.commit()
    return stats


def _cents(v: Any) -> float:
    try:
        return float(v) / 100.0
    except Exception:
        return 0.0


def _sync_catalog(db: Session, user_id: int, token: str) -> int:
    body = {"object_types": ["ITEM"]}
    data = _http_post(f"{_base_url()}/v2/catalog/search", body, token=token)
    objects = data.get("objects", []) or []
    existing = {i.name: i for i in db.query(MenuItem).filter(MenuItem.user_id == user_id).all()}
    count = 0
    for obj in objects:
        item = obj.get("item_data") or {}
        name = (item.get("name") or "").strip()
        if not name:
            continue
        # Price from the first variation.
        variations = item.get("variations") or []
        price = 0.0
        for v in variations:
            pm = (v.get("item_variation_data") or {}).get("price_money") or {}
            if pm.get("amount"):
                price = _cents(pm["amount"]); break
        category = item.get("category_id") or "general"
        row = existing.get(name)
        if row:
            if price:
                row.price = price
        else:
            row = MenuItem(user_id=user_id, name=name, category="general",
                           price=price or 0.0, cost=round((price or 0.0) * 0.35, 2),
                           orders_last_30_days=0, description=item.get("description") or "")
            db.add(row)
            existing[name] = row
        count += 1
    db.commit()
    return count


def _sync_orders(db: Session, user_id: int, token: str) -> tuple[int, float, dict]:
    """Pull the last 30 days of orders, write SalesLog rows, return
    (order_count, total_revenue, {item_name: qty})."""
    since = (datetime.utcnow() - timedelta(days=30)).replace(microsecond=0)
    body = {
        "location_ids": [],  # empty = all locations for the merchant
        "query": {
            "filter": {"date_time_filter": {"closed_at": {"start_at": since.isoformat() + "Z"}}},
            "sort": {"sort_field": "CLOSED_AT", "sort_order": "DESC"},
        },
        "limit": 500,
    }
    try:
        data = _http_post(f"{_base_url()}/v2/orders/search", body, token=token)
    except Exception:
        logger.warning("square: order search failed")
        return 0, 0.0, {}

    orders = data.get("orders", []) or []
    # Clear the last 30 days of prior synced logs to avoid double counting.
    db.query(SalesLog).filter(
        SalesLog.user_id == user_id, SalesLog.sale_date >= since.date(),
    ).delete(synchronize_session=False)

    per_item: dict[str, int] = {}
    total_revenue = 0.0
    for o in orders:
        closed = o.get("closed_at") or o.get("created_at")
        try:
            dt = datetime.fromisoformat((closed or "").replace("Z", "+00:00"))
        except Exception:
            dt = datetime.utcnow()
        for li in (o.get("line_items") or []):
            name = (li.get("name") or "").strip() or "Item"
            qty = int(float(li.get("quantity") or 1))
            gross = (li.get("gross_sales_money") or li.get("total_money") or {}).get("amount")
            revenue = _cents(gross) if gross else 0.0
            per_item[name] = per_item.get(name, 0) + qty
            total_revenue += revenue
            db.add(SalesLog(
                user_id=user_id, item_name=name, quantity=qty, revenue=revenue,
                sale_date=dt.date(), hour_of_day=dt.hour, day_of_week=dt.weekday(),
            ))
    db.commit()
    return len(orders), total_revenue, per_item


def _apply_order_counts(db: Session, user_id: int, per_item: dict) -> None:
    """Set MenuItem.orders_last_30_days from the synced order tallies so the
    dashboard/menu-AI reflect real volumes."""
    if not per_item:
        return
    items = {i.name: i for i in db.query(MenuItem).filter(MenuItem.user_id == user_id).all()}
    for name, qty in per_item.items():
        row = items.get(name)
        if row:
            row.orders_last_30_days = qty
    db.commit()


def sync_all_connected(db: Session) -> dict:
    """Cron entrypoint: sync every connected Square merchant."""
    conns = db.query(POSConnection).filter(
        POSConnection.provider == "square", POSConnection.connected == True,  # noqa: E712
    ).all()
    synced, failed = 0, 0
    for c in conns:
        try:
            sync(db, c.user_id)
            synced += 1
        except Exception:
            failed += 1
            logger.warning("square: sync failed for user %s", c.user_id)
    return {"connected": len(conns), "synced": synced, "failed": failed}
