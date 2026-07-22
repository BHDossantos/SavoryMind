"""Coaching engine orchestration (P2 §6).

Owns incidents (the ≤20-second quick-log source of truth), plan
generation + owner approval, delivery, and the "recovered this month"
counter that computes incident-trend improvement vs. a baseline.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from ..models.restaurant_ext import Staff, Incident, CoachingPlan
from ..models.user import User
from . import coaching_generator, push_service, whatsapp_service

INCIDENT_TYPES = ("waste", "portioning", "speed", "punctuality", "quality")


# ── Incidents ────────────────────────────────────────────────────────────────

def log_incident(db: Session, user_id: int, *, staff_id: int, type: str,
                 euro_impact: float, quantity: float | None = None,
                 unit: str | None = None, cause_tags: list[str] | None = None,
                 notes: str | None = None, occurred_at: date | None = None,
                 source: str = "manual") -> Incident:
    if type not in INCIDENT_TYPES:
        raise ValueError(f"invalid incident type: {type}")
    staff = db.query(Staff).filter(Staff.id == staff_id, Staff.user_id == user_id).first()
    if not staff:
        raise ValueError("staff not found")
    inc = Incident(
        user_id=user_id, staff_id=staff_id, type=type,
        occurred_at=occurred_at or date.today(),
        quantity=quantity, unit=unit,
        euro_impact=float(euro_impact or 0),
        cause_tags=json.dumps(cause_tags or []),
        source=source, notes=notes,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return inc


def _incident_dict(i: Incident) -> dict:
    return {
        "id": i.id, "staff_id": i.staff_id, "type": i.type,
        "occurred_at": str(i.occurred_at), "quantity": i.quantity, "unit": i.unit,
        "euro_impact": i.euro_impact,
        "cause_tags": json.loads(i.cause_tags or "[]"),
        "source": i.source, "notes": i.notes,
    }


def recent_incidents(db: Session, user_id: int, staff_id: int, days: int = 30) -> list[dict]:
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(Incident)
        .filter(Incident.user_id == user_id, Incident.staff_id == staff_id,
                Incident.occurred_at >= since)
        .order_by(Incident.occurred_at.desc())
        .all()
    )
    return [_incident_dict(i) for i in rows]


# ── Plan generation + approval ───────────────────────────────────────────────

def _iso_week(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def generate_plan_for_staff(db: Session, owner: User, staff: Staff,
                            *, period: str | None = None) -> CoachingPlan | None:
    """Generate (or regenerate) this period's draft plan for one staff
    member. Returns None if there are no incidents to coach on."""
    period = period or _iso_week(date.today())
    incidents = recent_incidents(db, owner.id, staff.id, days=30)
    if not incidents:
        return None

    language = staff.language or owner.language or "it"
    plan = coaching_generator.generate(
        staff={"name": staff.name, "role": staff.role},
        incidents=incidents,
        restaurant={"cuisine": owner.restaurant_cuisine,
                    "seating_capacity": owner.seating_capacity},
        language=language,
    )

    # One draft per staff per period — replace an existing unreviewed draft.
    existing = (
        db.query(CoachingPlan)
        .filter(CoachingPlan.user_id == owner.id, CoachingPlan.staff_id == staff.id,
                CoachingPlan.period == period, CoachingPlan.status == "draft")
        .first()
    )
    row = existing or CoachingPlan(user_id=owner.id, staff_id=staff.id, period=period)
    row.priority = plan["priority"]
    row.title = plan["title"]
    row.summary = plan["summary"]
    row.euro_impact_total = plan["euro_impact_total"]
    row.expected_recovery = plan["expected_recovery"]
    row.actions_json = json.dumps(plan["actions"])
    row.language = language
    row.status = "draft"
    row.generated_by_model = plan["generated_by_model"]
    row.reviewed_by_owner = False
    if not existing:
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def generate_all(db: Session, owner: User, *, period: str | None = None) -> list[CoachingPlan]:
    staff = db.query(Staff).filter(Staff.user_id == owner.id, Staff.active == True).all()  # noqa: E712
    plans = []
    for s in staff:
        p = generate_plan_for_staff(db, owner, s, period=period)
        if p:
            plans.append(p)
    return plans


def approve_plan(db: Session, owner_id: int, plan_id: int) -> CoachingPlan | None:
    plan = (
        db.query(CoachingPlan)
        .filter(CoachingPlan.id == plan_id, CoachingPlan.user_id == owner_id)
        .first()
    )
    if not plan:
        return None
    plan.status = "active"
    plan.reviewed_by_owner = True
    plan.delivered_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    _deliver(db, plan)
    return plan


def approve_all(db: Session, owner_id: int, *, period: str | None = None) -> int:
    q = db.query(CoachingPlan).filter(
        CoachingPlan.user_id == owner_id, CoachingPlan.status == "draft")
    if period:
        q = q.filter(CoachingPlan.period == period)
    count = 0
    for plan in q.all():
        plan.status = "active"
        plan.reviewed_by_owner = True
        plan.delivered_at = datetime.utcnow()
        count += 1
        db.commit()
        _deliver(db, plan)
    return count


def _deliver(db: Session, plan: CoachingPlan) -> None:
    """Best-effort delivery: owner in-app push + (if the employee has
    consented) a WhatsApp digest to the staff member. Never raises."""
    try:
        push_service.send_to_user(db, plan.user_id, "Piano di coaching pronto",
                                  plan.title, {"type": "coaching_plan", "plan_id": plan.id})
    except Exception:
        pass
    try:
        staff = db.query(Staff).filter(Staff.id == plan.staff_id).first()
        if staff and staff.whatsapp_number and staff.whatsapp_consent_at:
            body = whatsapp_service.staff_digest_body(plan_dict(plan), plan.language)
            whatsapp_service.send(db, user_id=plan.user_id, to=staff.whatsapp_number,
                                  template="staff_digest", body=body)
    except Exception:
        pass


def plan_dict(p: CoachingPlan) -> dict:
    return {
        "id": p.id, "staff_id": p.staff_id, "period": p.period,
        "priority": p.priority, "title": p.title, "summary": p.summary,
        "euro_impact_total": p.euro_impact_total, "expected_recovery": p.expected_recovery,
        "actions": json.loads(p.actions_json or "[]"),
        "language": p.language, "status": p.status,
        "generated_by_model": p.generated_by_model,
        "reviewed_by_owner": p.reviewed_by_owner,
        "delivered_at": p.delivered_at.isoformat() if p.delivered_at else None,
    }


def list_plans(db: Session, owner_id: int, *, status: str | None = None) -> list[dict]:
    q = db.query(CoachingPlan).filter(CoachingPlan.user_id == owner_id)
    if status:
        q = q.filter(CoachingPlan.status == status)
    rows = q.order_by(CoachingPlan.created_at.desc()).all()
    return [plan_dict(p) for p in rows]


# ── Recovered-€ counter (Dashboard) ──────────────────────────────────────────

def recovered_this_month(db: Session, owner_id: int) -> dict:
    """Compare this month's incident € to the prior month's, per staff.
    'Recovered' = the positive improvement (prior − current) summed across
    staff who improved. Honest: if losses grew, recovered is 0, not negative."""
    today = date.today()
    cur_start = today.replace(day=1)
    prev_end = cur_start - timedelta(days=1)
    prev_start = prev_end.replace(day=1)

    def _sum(a, b):
        rows = (
            db.query(Incident.staff_id, Incident.euro_impact)
            .filter(Incident.user_id == owner_id,
                    Incident.occurred_at >= a, Incident.occurred_at <= b)
            .all()
        )
        agg: dict[int, float] = {}
        for sid, eur in rows:
            agg[sid] = agg.get(sid, 0.0) + (eur or 0.0)
        return agg

    cur = _sum(cur_start, today)
    prev = _sum(prev_start, prev_end)

    recovered = 0.0
    for sid, prev_loss in prev.items():
        cur_loss = cur.get(sid, 0.0)
        if cur_loss < prev_loss:
            recovered += (prev_loss - cur_loss)

    return {
        "recovered_this_month": round(recovered, 2),
        "current_month_loss": round(sum(cur.values()), 2),
        "prior_month_loss": round(sum(prev.values()), 2),
    }
