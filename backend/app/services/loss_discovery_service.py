"""Loss Discovery orchestration — persists versioned estimates and owns the
honest-guarantee hook.

Wraps the pure `loss_engine` with DB concerns: reads the restaurant's
profile, runs the estimate, writes an immutable `LossEstimate` row (next
version number), and sets `guarantee_triggered` when the high estimate is
under €500 so the trial doesn't auto-convert (notes §4.1.5). Never fakes
the number to clear €500 — credibility is the moat.
"""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ..models.loss import LossEstimate
from ..models.user import User
from . import loss_engine

GUARANTEE_THRESHOLD_EUR = 500.0


def _profile_of(user: User) -> dict:
    return {
        "covers_per_day": user.covers_per_day,
        "avg_ticket_eur": user.avg_ticket_eur,
        "staff_count": user.staff_count,
        "monthly_food_purchases_eur": user.monthly_food_purchases_eur,
        "avg_hourly_wage_eur": user.avg_hourly_wage_eur,
    }


def run_estimate(db: Session, user: User, *, audit: dict | None = None,
                 sales_summary: dict | None = None) -> LossEstimate:
    """Compute + persist a new estimate version for this restaurant."""
    profile = _profile_of(user)
    result = loss_engine.estimate(profile, audit=audit, sales_summary=sales_summary)

    last = (
        db.query(LossEstimate)
        .filter(LossEstimate.user_id == user.id)
        .order_by(LossEstimate.version.desc())
        .first()
    )
    next_version = (last.version + 1) if last else 1

    triggered = result["total_monthly_loss_high"] < GUARANTEE_THRESHOLD_EUR

    row = LossEstimate(
        user_id=user.id,
        version=next_version,
        data_path=result["data_path"],
        total_monthly_loss_low=result["total_monthly_loss_low"],
        total_monthly_loss_high=result["total_monthly_loss_high"],
        breakdown_json=json.dumps(result["breakdown"]),
        inputs_json=json.dumps({"profile": profile, "audit": audit or {},
                                "sales_summary": sales_summary or {}}),
        guarantee_triggered=triggered,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def latest(db: Session, user_id: int) -> LossEstimate | None:
    return (
        db.query(LossEstimate)
        .filter(LossEstimate.user_id == user_id)
        .order_by(LossEstimate.version.desc())
        .first()
    )


def to_dict(row: LossEstimate | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row.id,
        "version": row.version,
        "data_path": row.data_path,
        "total_monthly_loss_low": row.total_monthly_loss_low,
        "total_monthly_loss_high": row.total_monthly_loss_high,
        "breakdown": json.loads(row.breakdown_json or "[]"),
        "guarantee_triggered": row.guarantee_triggered,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
