from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import Payment, User
from app.services import payments as pay

router = APIRouter(prefix="/api/payments", tags=["payments"])


class CheckoutIn(BaseModel):
    purpose: str
    plan_id: Optional[int] = None
    booking_id: Optional[int] = None
    venue_id: Optional[int] = None
    amount_eur: Optional[float] = None


@router.get("/prices")
def prices():
    return [
        {"key": k, **v}
        for k, v in pay.PRICE_TABLE.items()
    ]


@router.post("/checkout")
def checkout(
    payload: CheckoutIn,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    if payload.purpose not in pay.PRICE_TABLE and payload.amount_eur is None:
        raise HTTPException(400, "Unknown purpose. Provide amount_eur or use a known purpose.")
    return pay.create_checkout_session(
        db,
        purpose=payload.purpose,
        amount_eur=payload.amount_eur,
        user_id=user.id if user else None,
        plan_id=payload.plan_id,
        booking_id=payload.booking_id,
        venue_id=payload.venue_id,
    )


@router.post("/{payment_id}/mock-confirm")
def mock_confirm(payment_id: int, db: Session = Depends(get_db)):
    if pay.is_stripe_configured():
        raise HTTPException(400, "Stripe is configured — use the real flow")
    p = pay.mark_payment_succeeded(db, payment_id)
    return {"status": p.status, "id": p.id}


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe webhook receiver.

    - Verifies signature using NOCTURNA_STRIPE_WEBHOOK_SECRET
    - Idempotent: duplicate event IDs are no-ops
    - Dispatches checkout, payment_intent, invoice, refund, subscription
      events to the right handlers; sends receipt / failure emails as
      a side effect
    """
    sig = request.headers.get("stripe-signature", "")
    raw = await request.body()
    if not pay.is_stripe_configured():
        return {"received": True, "ignored": "stripe_not_configured"}
    try:
        event = pay.verify_webhook(raw, sig)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return pay.handle_webhook_event(db, dict(event))


@router.get("/me")
def my_payments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional),
):
    if not user:
        return []
    rows = db.query(Payment).filter(Payment.user_id == user.id).order_by(Payment.id.desc()).all()
    return [
        {
            "id": p.id,
            "purpose": p.purpose,
            "amount_eur": p.amount_eur,
            "currency": p.currency,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "plan_id": p.plan_id,
            "booking_id": p.booking_id,
        }
        for p in rows
    ]
