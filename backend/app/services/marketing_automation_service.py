"""Trigger-based marketing automation (AI-OS Module 8).

Turns passive CRM data into timely, owner-approved actions:
  - birthday   → a customer's birthday falls in the next 7 days → offer
  - lapsed     → a regular hasn't visited in 31–120 days → win-back

The daily cron detects new triggers, records them (idempotent via the
unique period key), and notifies the owner. The owner one-click sends —
we never message a diner automatically, which keeps it GDPR-clean.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models.restaurant_ext import CRMCustomer
from ..models.marketing import MarketingTrigger
from . import notification_service

LAPSED_MIN_DAYS = 31
LAPSED_MAX_DAYS = 120


def _birthday_within(bday: date | None, today: date, days: int) -> bool:
    if not bday:
        return False
    # Compare month/day only; handle year wrap within the window.
    for d in range(days + 1):
        t = today + timedelta(days=d)
        if t.month == bday.month and t.day == bday.day:
            return True
    return False


def run_triggers(db: Session, owner) -> list[dict]:
    """Detect + persist new triggers for one restaurant; notify the owner.
    Returns the list of newly-created triggers (idempotent across runs)."""
    today = date.today()
    customers = db.query(CRMCustomer).filter(CRMCustomer.user_id == owner.id).all()
    new_triggers: list[dict] = []

    for c in customers:
        # Birthday (once per year).
        if _birthday_within(c.birthday, today, 7):
            period = f"{today.year}-bday"
            if _record(db, owner.id, c.id, "birthday", period):
                notification_service.create(
                    db, owner.id,
                    f"🎂 Il compleanno di {c.name} è vicino — invia un dolce omaggio?",
                    link="/restaurant/crm", push=False)
                new_triggers.append({"customer_id": c.id, "name": c.name, "type": "birthday"})

        # Lapsed regular (once per month window).
        if c.last_visit:
            gap = (today - c.last_visit).days
            if LAPSED_MIN_DAYS <= gap <= LAPSED_MAX_DAYS:
                period = f"{today.year}-{today.month:02d}-lapsed"
                if _record(db, owner.id, c.id, "lapsed", period):
                    notification_service.create(
                        db, owner.id,
                        f"👋 {c.name} non torna da {gap} giorni — invia un coupon per riportarlo?",
                        link="/restaurant/crm", push=False)
                    new_triggers.append({"customer_id": c.id, "name": c.name,
                                         "type": "lapsed", "days": gap})

    db.commit()
    return new_triggers


def _record(db: Session, user_id: int, customer_id: int, ttype: str, period: str) -> bool:
    """Insert a trigger row; return False if it already exists (dedup)."""
    exists = (db.query(MarketingTrigger)
              .filter(MarketingTrigger.customer_id == customer_id,
                      MarketingTrigger.trigger_type == ttype,
                      MarketingTrigger.period == period)
              .first())
    if exists:
        return False
    db.add(MarketingTrigger(user_id=user_id, customer_id=customer_id,
                            trigger_type=ttype, period=period, status="suggested"))
    db.flush()
    return True


def list_triggers(db: Session, owner_id: int, status: str = "suggested") -> list[dict]:
    rows = (db.query(MarketingTrigger, CRMCustomer)
            .join(CRMCustomer, CRMCustomer.id == MarketingTrigger.customer_id)
            .filter(MarketingTrigger.user_id == owner_id,
                    MarketingTrigger.status == status)
            .order_by(MarketingTrigger.created_at.desc())
            .all())
    return [{
        "id": tr.id, "customer_id": tr.customer_id, "customer_name": c.name,
        "trigger_type": tr.trigger_type, "status": tr.status,
        "phone": c.phone, "email": c.email,
        "created_at": tr.created_at.isoformat() if tr.created_at else None,
    } for tr, c in rows]


def mark(db: Session, owner_id: int, trigger_id: int, status: str) -> bool:
    tr = (db.query(MarketingTrigger)
          .filter(MarketingTrigger.id == trigger_id, MarketingTrigger.user_id == owner_id)
          .first())
    if not tr:
        return False
    tr.status = status
    db.commit()
    return True
