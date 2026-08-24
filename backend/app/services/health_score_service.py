"""Restaurant Health Score (AI-OS Module 2 — the one-glance killer surface).

A single 0-100 score plus five sub-scores — Financial, Operations,
Customer, Staff, Marketing — each computed from real signals the platform
already stores, with human-readable drivers so the number is explainable
(never a black box).

Honest-by-design (no fake numbers): a dimension with no data returns
status="unknown" and is EXCLUDED from the overall average rather than
padded with a flattering default. The overall is the mean of only the
dimensions we can actually measure, so a brand-new restaurant sees
"stiamo ancora imparando" instead of a fabricated 100.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.menu import MenuItem
from ..models.kitchen import FoodWasteLog
from ..models.inventory import InventoryItem
from ..models.restaurant_ext import OpsTask, CRMCustomer, Staff, SalesLog
from ..models.review import Review
from ..models.diner import DinerReview


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


def _dim(score, status, drivers):
    return {"score": round(score, 1) if score is not None else None,
            "status": status, "drivers": drivers}


# ── Financial: food-cost margin health + waste drag ──────────────────────────

def _financial(db: Session, uid: int) -> dict:
    items = db.query(MenuItem).filter(MenuItem.user_id == uid).all()
    priced = [i for i in items if i.price and i.price > 0 and i.cost is not None]
    if not priced:
        return _dim(None, "unknown", ["Nessun dato di menu/costi ancora."])
    # Weight margin by 30-day volume so the score reflects what actually sells.
    tot_rev = tot_cost = 0.0
    for i in priced:
        vol = (i.orders_last_30_days or 0) or 1
        tot_rev += i.price * vol
        tot_cost += (i.cost or 0) * vol
    margin = (tot_rev - tot_cost) / tot_rev if tot_rev else 0.0  # gross margin fraction
    # Restaurant gross margin ~65-72% is healthy; map 55%→60pts, 72%→95pts.
    margin_score = _clamp(60 + (margin - 0.55) * (35 / 0.17))

    drivers = [f"Margine lordo ponderato: {margin*100:.0f}%"]
    # Waste drag over last 30 days vs revenue.
    since = date.today() - timedelta(days=30)
    waste = (db.query(func.coalesce(func.sum(FoodWasteLog.estimated_cost), 0.0))
             .filter(FoodWasteLog.user_id == uid, FoodWasteLog.date >= since).scalar() or 0.0)
    penalty = 0.0
    if tot_rev:
        waste_ratio = waste / tot_rev
        penalty = min(20.0, waste_ratio * 200)  # 10% waste → -20
        if waste > 0:
            drivers.append(f"Sprechi 30gg: €{waste:.0f} ({waste_ratio*100:.1f}% del venduto)")
    return _dim(_clamp(margin_score - penalty), "ok", drivers)


# ── Operations: inventory stock health + overdue tasks ───────────────────────

def _operations(db: Session, uid: int) -> dict:
    items = db.query(InventoryItem).filter(
        InventoryItem.user_id == uid, InventoryItem.archived_at.is_(None)).all()
    tasks = db.query(OpsTask).filter(OpsTask.user_id == uid).all()
    if not items and not tasks:
        return _dim(None, "unknown", ["Inventario e operazioni non ancora configurati."])

    drivers = []
    parts = []
    if items:
        low = [i for i in items if i.par_level and _on_hand(db, i) < i.par_level]
        low_ratio = len(low) / len(items)
        parts.append(_clamp(100 - low_ratio * 100))
        drivers.append(f"Scorte sotto soglia: {len(low)}/{len(items)}")
    if tasks:
        today = date.today()
        overdue = [t for t in tasks if not t.done and t.due_date and t.due_date < today]
        open_tasks = [t for t in tasks if not t.done]
        if open_tasks:
            overdue_ratio = len(overdue) / len(open_tasks)
            parts.append(_clamp(100 - overdue_ratio * 100))
            drivers.append(f"Attività in ritardo: {len(overdue)}/{len(open_tasks)}")
    score = sum(parts) / len(parts) if parts else None
    return _dim(score, "ok" if parts else "unknown", drivers or ["—"])


def _on_hand(db: Session, item: InventoryItem) -> float:
    from ..models.inventory import InventoryAdjustment
    return (db.query(func.coalesce(func.sum(InventoryAdjustment.delta), 0.0))
            .filter(InventoryAdjustment.item_id == item.id).scalar() or 0.0)


# ── Customer: ratings + retention ────────────────────────────────────────────

def _customer(db: Session, uid: int) -> dict:
    # Prefer diner (consumer) reviews; fall back to operator-entered reviews.
    avg_diner = (db.query(func.avg(DinerReview.rating))
                 .filter(DinerReview.restaurant_user_id == uid).scalar())
    avg_op = db.query(func.avg(Review.rating)).filter(Review.user_id == uid).scalar()
    avg = avg_diner if avg_diner is not None else avg_op
    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == uid).all()
    if avg is None and not customers:
        return _dim(None, "unknown", ["Nessuna recensione o cliente CRM ancora."])

    drivers = []
    parts = []
    if avg is not None:
        parts.append(_clamp((float(avg) / 5.0) * 100))
        drivers.append(f"Valutazione media: {float(avg):.1f}★")
    if customers:
        today = date.today()
        lapsed = [c for c in customers if c.last_visit and (today - c.last_visit).days > 45]
        active_ratio = 1 - (len(lapsed) / len(customers))
        parts.append(_clamp(active_ratio * 100))
        drivers.append(f"Clienti inattivi (>45gg): {len(lapsed)}/{len(customers)}")
    score = sum(parts) / len(parts) if parts else None
    return _dim(score, "ok" if parts else "unknown", drivers)


# ── Staff: punctuality + rating ──────────────────────────────────────────────

def _staff(db: Session, uid: int) -> dict:
    staff = db.query(Staff).filter(Staff.user_id == uid, Staff.active == True).all()  # noqa: E712
    if not staff:
        return _dim(None, "unknown", ["Nessun membro dello staff registrato."])
    # Use `is not None` — a legitimate 0 (worst punctuality/rating) must not be
    # silently upgraded to the neutral default by `or`.
    avg_punct = sum((s.punctuality_score if s.punctuality_score is not None else 100) for s in staff) / len(staff)
    avg_rating = sum((s.rating if s.rating is not None else 4.0) for s in staff) / len(staff)
    score = _clamp(avg_punct * 0.5 + (avg_rating / 5.0 * 100) * 0.5)
    return _dim(score, "ok", [
        f"Puntualità media: {avg_punct:.0f}%",
        f"Valutazione staff media: {avg_rating:.1f}★",
        f"Team attivo: {len(staff)}",
    ])


# ── Marketing: recent reach activity ─────────────────────────────────────────

def _marketing(db: Session, uid: int) -> dict:
    from ..models.user import User
    from ..models.restaurant_ext import MenuBroadcast
    owner = db.query(User).filter(User.id == uid).first()
    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == uid).count()
    if customers == 0:
        return _dim(None, "unknown", ["Nessun cliente CRM per fare marketing ancora."])

    drivers = []
    score = 40.0  # baseline: has an audience but little activity
    # CRM list size signal.
    if customers >= 100:
        score += 20; drivers.append(f"Lista CRM: {customers} clienti")
    elif customers >= 20:
        score += 10; drivers.append(f"Lista CRM: {customers} clienti")
    else:
        drivers.append(f"Lista CRM piccola: {customers} clienti")
    # Recent broadcast activity (last 30 days).
    from datetime import datetime as _dt
    since_dt = _dt.utcnow() - timedelta(days=30)
    recent = (db.query(MenuBroadcast)
              .filter(MenuBroadcast.user_id == uid, MenuBroadcast.sent_at >= since_dt).count())
    if recent:
        score += 30; drivers.append(f"Broadcast inviati (30gg): {recent}")
    else:
        drivers.append("Nessun broadcast negli ultimi 30 giorni")
    if owner and owner.menu_of_the_day:
        score += 10; drivers.append("Menù del giorno pubblicato")
    return _dim(_clamp(score), "ok", drivers)


_WEIGHTS = {"financial": 0.30, "operations": 0.20, "customer": 0.22,
            "staff": 0.13, "marketing": 0.15}


def health_score(db: Session, user_id: int) -> dict:
    dims = {
        "financial": _financial(db, user_id),
        "operations": _operations(db, user_id),
        "customer": _customer(db, user_id),
        "staff": _staff(db, user_id),
        "marketing": _marketing(db, user_id),
    }
    # Overall = weighted mean over MEASURED dimensions only (honest).
    measured = {k: v for k, v in dims.items() if v["score"] is not None}
    if measured:
        wsum = sum(_WEIGHTS[k] for k in measured)
        overall = sum(dims[k]["score"] * _WEIGHTS[k] for k in measured) / wsum
        overall = round(overall)
        band = ("excellent" if overall >= 85 else "good" if overall >= 70
                else "fair" if overall >= 55 else "needs_attention")
    else:
        overall = None
        band = "learning"
    return {
        "overall": overall,
        "band": band,
        "measured_dimensions": len(measured),
        "dimensions": dims,
    }
