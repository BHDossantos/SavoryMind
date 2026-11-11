from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from ..availability_engine import _payment_active
from ..db import get_session
from ..models import Appointment, AppointmentStatus, Payment, PaymentStatus, User
from ..notifications_service import enqueue_for_appointment
from ..payments_client import is_stub_mode, verify_webhook
from ..security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


def _mark_paid(session: Session, payment: Payment) -> None:
    if payment.status == PaymentStatus.paid:
        return
    appt = session.get(Appointment, payment.appointment_id)
    if (payment.status != PaymentStatus.pending or not appt
            or appt.status != AppointmentStatus.confirmed or not _payment_active(appt)):
        raise HTTPException(status_code=409, detail="Payment cannot confirm a cancelled or expired booking")
    payment.status = PaymentStatus.paid
    payment.updated_at = datetime.utcnow()
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
    if is_stub_mode():
        raise HTTPException(status_code=404, detail="Webhooks disabled in demo mode")
    payload = await request.body()
    try:
        event = verify_webhook(payload, stripe_signature or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type") if isinstance(event, dict) else event["type"]
    if event_type == "checkout.session.completed":
        data = event["data"]["object"]
        metadata = data.get("metadata") or {}
        if data.get("payment_status") != "paid":
            return {"ignored": True}
        try:
            payment_id = int(metadata.get("payment_id", 0))
        except (ValueError, TypeError):
            return {"ignored": True}
        if not payment_id:
            return {"ignored": True}
        payment = session.get(Payment, payment_id)
        if not payment:
            return {"ignored": True}
        if (data.get("id") != payment.provider_session_id
                or data.get("amount_total") != payment.amount_cents
                or str(data.get("currency", "")).lower() != payment.currency.lower()):
            raise HTTPException(status_code=400, detail="Checkout does not match payment")
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
