"""CSV export endpoints for accounting / partner invoicing."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.models import Booking, Payment, Venue

router = APIRouter(prefix="/api/admin/export", tags=["admin"])


def _csv_response(filename: str, rows: list[list], header: list[str]) -> StreamingResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bookings.csv")
def export_bookings(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    status: Optional[str] = None,
    days: int = Query(default=90, le=365),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    qry = db.query(Booking).filter(Booking.created_at >= cutoff)
    if status:
        qry = qry.filter(Booking.status == status)
    rows = qry.order_by(Booking.created_at.desc()).all()
    venues = {v.id: v for v in db.query(Venue).all()}

    header = [
        "id", "created_at", "status", "venue_name", "city", "neighborhood",
        "date", "time", "group_size", "request_type", "vip_interest",
        "contact_name", "contact_phone", "contact_email",
        "budget_eur", "commission_eur", "venue_response", "admin_notes", "plan_id",
    ]
    out = []
    for b in rows:
        v = venues.get(b.venue_id)
        out.append([
            b.id,
            b.created_at.isoformat() if b.created_at else "",
            b.status,
            v.name if v else "",
            v.city if v else "",
            v.neighborhood if v else "",
            b.date, b.time, b.group_size, b.request_type, b.vip_interest,
            b.contact_name, b.contact_phone, b.contact_email,
            b.budget_eur or "",
            b.commission_eur or "",
            (b.venue_response or "").replace("\n", " "),
            (b.admin_notes or "").replace("\n", " "),
            b.plan_id or "",
        ])
    return _csv_response(f"nocturna-bookings-{datetime.utcnow():%Y%m%d}.csv", out, header)


@router.get("/payments.csv")
def export_payments(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    status: Optional[str] = None,
    days: int = Query(default=90, le=365),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    qry = db.query(Payment).filter(Payment.created_at >= cutoff)
    if status:
        qry = qry.filter(Payment.status == status)
    rows = qry.order_by(Payment.created_at.desc()).all()

    header = [
        "id", "created_at", "purpose", "status", "amount_eur", "currency",
        "user_id", "plan_id", "booking_id", "venue_id",
        "stripe_session_id", "stripe_payment_intent_id", "receipt_url", "failure_message",
    ]
    out = []
    for p in rows:
        out.append([
            p.id,
            p.created_at.isoformat() if p.created_at else "",
            p.purpose, p.status,
            f"{p.amount_eur:.2f}", p.currency,
            p.user_id or "", p.plan_id or "", p.booking_id or "", p.venue_id or "",
            p.stripe_session_id or "", p.stripe_payment_intent_id or "",
            p.receipt_url or "",
            (p.failure_message or "").replace("\n", " "),
        ])
    return _csv_response(f"nocturna-payments-{datetime.utcnow():%Y%m%d}.csv", out, header)


@router.get("/commissions.csv")
def export_commissions(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    days: int = Query(default=90, le=365),
):
    """Per-venue commission rollup — what we'd invoice each venue partner."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(Booking)
        .filter(Booking.created_at >= cutoff, Booking.status.in_(["confirmed", "completed"]))
        .all()
    )
    venues = {v.id: v for v in db.query(Venue).all()}

    by_venue: dict[int, dict] = {}
    for b in rows:
        v = venues.get(b.venue_id)
        if not v:
            continue
        agg = by_venue.setdefault(v.id, {
            "venue_id": v.id, "venue_name": v.name, "city": v.city,
            "partner_status": v.partner_status, "bookings": 0, "vip_bookings": 0,
            "total_commission_eur": 0.0,
        })
        agg["bookings"] += 1
        if b.vip_interest == "yes":
            agg["vip_bookings"] += 1
        agg["total_commission_eur"] += float(b.commission_eur or 0)

    header = ["venue_id", "venue_name", "city", "partner_status", "bookings", "vip_bookings", "total_commission_eur"]
    out = [
        [a["venue_id"], a["venue_name"], a["city"], a["partner_status"],
         a["bookings"], a["vip_bookings"], f"{a['total_commission_eur']:.2f}"]
        for a in sorted(by_venue.values(), key=lambda x: -x["total_commission_eur"])
    ]
    return _csv_response(f"nocturna-commissions-{datetime.utcnow():%Y%m%d}.csv", out, header)
