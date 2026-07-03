"""Loyalty rewards + redemption.

Wave C of the Restaurant OS. Points and tiers already accrue on
crm_customers via crm_service.record_visit (Wave A). This module manages
the reward catalog a restaurant defines and the redemption flow that
deducts points atomically.

Redemption invariants:
  - reward must belong to the restaurant and be active
  - customer must belong to the restaurant
  - customer must have >= points_cost points
  - on success: deduct points, re-derive tier, write a snapshotted
    redemption row (so history survives reward edits/deletes)
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models.restaurant_ext import CRMCustomer, LoyaltyRedemption, LoyaltyReward
from . import crm_service


class LoyaltyError(Exception):
    """Raised on a business-rule violation (not found / insufficient points).
    The route maps this to a 4xx with the message."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


# --- Reward catalog ---------------------------------------------------------

def list_rewards(db: Session, user_id: int, *, active_only: bool = False) -> list[LoyaltyReward]:
    q = db.query(LoyaltyReward).filter(LoyaltyReward.user_id == user_id)
    if active_only:
        q = q.filter(LoyaltyReward.active == True)  # noqa: E712
    return q.order_by(LoyaltyReward.points_cost.asc()).all()


def create_reward(db: Session, user_id: int, *, name: str, points_cost: int,
                  description: str | None = None) -> LoyaltyReward:
    if not name.strip():
        raise LoyaltyError("Reward name is required.")
    if points_cost <= 0:
        raise LoyaltyError("points_cost must be positive.")
    r = LoyaltyReward(
        user_id=user_id, name=name.strip(),
        description=(description or "").strip() or None,
        points_cost=int(points_cost), active=True,
    )
    db.add(r); db.commit(); db.refresh(r)
    return r


def update_reward(db: Session, user_id: int, reward_id: int, **fields) -> Optional[LoyaltyReward]:
    r = db.query(LoyaltyReward).filter(
        LoyaltyReward.id == reward_id, LoyaltyReward.user_id == user_id,
    ).first()
    if not r:
        return None
    for k in ("name", "description", "points_cost", "active"):
        if k in fields and fields[k] is not None:
            setattr(r, k, fields[k])
    db.commit(); db.refresh(r)
    return r


def delete_reward(db: Session, user_id: int, reward_id: int) -> bool:
    r = db.query(LoyaltyReward).filter(
        LoyaltyReward.id == reward_id, LoyaltyReward.user_id == user_id,
    ).first()
    if not r:
        return False
    db.delete(r); db.commit()
    return True


# --- Redemption -------------------------------------------------------------

def affordable_for_customer(db: Session, user_id: int, customer_id: int) -> dict:
    """What this customer can redeem right now: their balance/tier plus the
    active rewards they can afford."""
    c = db.query(CRMCustomer).filter(
        CRMCustomer.id == customer_id, CRMCustomer.user_id == user_id,
    ).first()
    if not c:
        raise LoyaltyError("Customer not found.", status_code=404)
    points = c.loyalty_points or 0
    rewards = list_rewards(db, user_id, active_only=True)
    return {
        "customer_id": customer_id,
        "loyalty_points": points,
        "loyalty_tier": c.loyalty_tier,
        "rewards": [
            {
                "id": r.id, "name": r.name, "description": r.description,
                "points_cost": r.points_cost, "affordable": points >= r.points_cost,
            }
            for r in rewards
        ],
    }


def redeem(db: Session, user_id: int, customer_id: int, reward_id: int) -> dict:
    c = db.query(CRMCustomer).filter(
        CRMCustomer.id == customer_id, CRMCustomer.user_id == user_id,
    ).first()
    if not c:
        raise LoyaltyError("Customer not found.", status_code=404)
    r = db.query(LoyaltyReward).filter(
        LoyaltyReward.id == reward_id, LoyaltyReward.user_id == user_id,
    ).first()
    if not r:
        raise LoyaltyError("Reward not found.", status_code=404)
    if not r.active:
        raise LoyaltyError("Reward is not active.")
    if (c.loyalty_points or 0) < r.points_cost:
        raise LoyaltyError(
            f"Not enough points: {c.loyalty_points or 0} < {r.points_cost}."
        )

    c.loyalty_points = (c.loyalty_points or 0) - r.points_cost
    c.loyalty_tier = crm_service._loyalty_tier(c.loyalty_points)
    redemption = LoyaltyRedemption(
        user_id=user_id, customer_id=customer_id, reward_id=r.id,
        reward_name=r.name, points_spent=r.points_cost, redeemed_at=datetime.utcnow(),
    )
    db.add(redemption)
    db.commit(); db.refresh(c); db.refresh(redemption)
    return {
        "redemption_id": redemption.id,
        "reward_name": r.name,
        "points_spent": r.points_cost,
        "remaining_points": c.loyalty_points,
        "loyalty_tier": c.loyalty_tier,
    }


def redemption_history(db: Session, user_id: int, customer_id: int, *, limit: int = 20) -> list[dict]:
    rows = (
        db.query(LoyaltyRedemption)
        .filter(LoyaltyRedemption.user_id == user_id,
                LoyaltyRedemption.customer_id == customer_id)
        .order_by(LoyaltyRedemption.redeemed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": x.id, "reward_name": x.reward_name, "points_spent": x.points_spent,
         "redeemed_at": x.redeemed_at.isoformat()}
        for x in rows
    ]
