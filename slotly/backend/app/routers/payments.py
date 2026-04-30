from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from ..db import get_session
from ..models import Appointment, AppointmentStatus, Payment, PaymentStatus, User
from ..notifications_service import enqueue_for_appointment
from ..payments_client import is_stub_mode, verify_webhook
from ..security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


def _mark_paid(session: Session, payment: Payment) -> None:
    if payment.status == PaymentStatus.paid:
        return
    payment.status = PaymentStatus.paid
    payment.updated_at = datetime.utcnow()
    appt = session.get(Appointment, payment.appointment_id)
    if appt:
        appt.payment_status = PaymentStatus.paid
        session.add(appt)
        enqueue_for_appointment(session, appt.id)
    session.add(payment)


@router.post("/stub-confirm/{payment_id}")
def stub_confirm(
    payment_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict:
    """In stub mode the customer 'pays' by hitting this endpoint after Stripe redirects.

    Real Stripe deployments use the webhook below instead.
    """
    if not is_stub_mode():
        raise HTTPException(status_code=400, detail="Endpoint only available in stub mode")
    payment = session.get(Payment, payment_id)
    if not payment or payment.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Payment not found")
    _mark_paid(session, payment)
    session.commit()
    return {"status": payment.status}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    session: Session = Depends(get_session),
) -> dict:
    payload = await request.body()
    try:
        event = verify_webhook(payload, stripe_signature or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook signature error: {e}")

    event_type = event.get("type") if isinstance(event, dict) else event["type"]
    if event_type == "checkout.session.completed":
        data = event["data"]["object"]
        metadata = data.get("metadata") or {}
        payment_id = int(metadata.get("payment_id", 0))
        if not payment_id:
            return {"ignored": True}
        payment = session.get(Payment, payment_id)
        if not payment:
            return {"ignored": True}
        if "payment_intent" in data and data.get("payment_intent"):
            payment.provider_payment_id = data["payment_intent"]
        _mark_paid(session, payment)
        session.commit()
    return {"ok": True}


@router.get("/{payment_id}")
def get_payment(
    payment_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict:
    payment = session.get(Payment, payment_id)
    if not payment or payment.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {
        "id": payment.id,
        "appointment_id": payment.appointment_id,
        "amount_cents": payment.amount_cents,
        "currency": payment.currency,
        "status": payment.status,
        "refunded_amount_cents": payment.refunded_amount_cents,
    }
