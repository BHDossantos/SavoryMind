"""Admin tools to inspect + smoke-test the notifications stack."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.models import NotificationLog
from app.services import notifications, payments

router = APIRouter(prefix="/api/admin/notifications", tags=["admin"])


class TestSendIn(BaseModel):
    channel: str = Field(..., description="email | sms | whatsapp | push")
    to: str
    subject: Optional[str] = "Nocturna · test"
    body: str = "This is a Nocturna delivery test."


@router.post("/test")
def send_test(
    payload: TestSendIn,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """Fire a single test message through the configured provider.

    If the relevant provider is not configured, it logs to the console (dev
    fallback) and the response says so. Useful to validate Twilio / SendGrid
    / Expo credentials end-to-end.
    """
    ch = payload.channel.lower()
    if ch == "email":
        log = notifications.send_email(db, payload.to, payload.subject or "Nocturna · test", payload.body)
    elif ch == "sms":
        log = notifications.send_sms(db, payload.to, payload.body)
    elif ch == "whatsapp":
        log = notifications.send_whatsapp(db, payload.to, payload.body)
    elif ch == "push":
        log = notifications.send_push(db, payload.to, payload.subject or "Nocturna · test", payload.body)
    else:
        raise HTTPException(400, f"Unknown channel: {ch}")
    return {
        "id": log.id,
        "channel": log.channel,
        "provider": log.provider,
        "status": log.status,
        "error": log.error,
        "recipient": log.recipient,
    }


@router.get("/providers")
def providers_status():
    """Which providers are configured (no secrets returned)."""
    import os
    return {
        "email_sendgrid": bool(os.getenv("NOCTURNA_SENDGRID_KEY")),
        "sms_twilio": bool(os.getenv("NOCTURNA_TWILIO_SID") and os.getenv("NOCTURNA_TWILIO_TOKEN") and os.getenv("NOCTURNA_TWILIO_FROM_SMS")),
        "whatsapp_twilio": bool(os.getenv("NOCTURNA_TWILIO_SID") and os.getenv("NOCTURNA_TWILIO_TOKEN") and os.getenv("NOCTURNA_TWILIO_FROM_WHATSAPP")),
        "push_expo": True,  # Expo push doesn't require server-side key
        "stripe": payments.is_stripe_configured(),
    }


@router.get("/log")
def list_log(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    channel: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
):
    qry = db.query(NotificationLog)
    if channel:
        qry = qry.filter(NotificationLog.channel == channel)
    if status:
        qry = qry.filter(NotificationLog.status == status)
    rows = qry.order_by(NotificationLog.id.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "channel": r.channel,
            "recipient": r.recipient,
            "subject": r.subject,
            "body": r.body,
            "provider": r.provider,
            "status": r.status,
            "error": r.error,
            "user_id": r.user_id,
            "booking_id": r.booking_id,
            "plan_id": r.plan_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
