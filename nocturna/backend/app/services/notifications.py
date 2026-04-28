"""Multi-channel notification dispatcher (email, SMS, WhatsApp, push).

Defaults to console logging when provider keys are absent so the app runs
locally without external dependencies. In production, set the env vars below.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.models.notification import NotificationLog

log = logging.getLogger("nocturna.notifications")


TWILIO_SID = os.getenv("NOCTURNA_TWILIO_SID")
TWILIO_TOKEN = os.getenv("NOCTURNA_TWILIO_TOKEN")
TWILIO_FROM_SMS = os.getenv("NOCTURNA_TWILIO_FROM_SMS")
TWILIO_FROM_WHATSAPP = os.getenv("NOCTURNA_TWILIO_FROM_WHATSAPP", "whatsapp:+14155238886")
SENDGRID_KEY = os.getenv("NOCTURNA_SENDGRID_KEY")
SENDGRID_FROM = os.getenv("NOCTURNA_SENDGRID_FROM", "no-reply@nocturna.app")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _record(
    db: Session,
    *,
    channel: str,
    recipient: str,
    body: str,
    subject: Optional[str] = None,
    payload: Optional[dict] = None,
    user_id: Optional[int] = None,
    booking_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    provider: Optional[str] = None,
    provider_message_id: Optional[str] = None,
    status: str = "queued",
    error: Optional[str] = None,
) -> NotificationLog:
    row = NotificationLog(
        channel=channel,
        recipient=recipient,
        subject=subject,
        body=body,
        payload=payload,
        user_id=user_id,
        booking_id=booking_id,
        plan_id=plan_id,
        provider=provider,
        provider_message_id=provider_message_id,
        status=status,
        error=error,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def send_email(db: Session, to: str, subject: str, body: str, **ctx) -> NotificationLog:
    if SENDGRID_KEY:
        try:
            r = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {SENDGRID_KEY}", "Content-Type": "application/json"},
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {"email": SENDGRID_FROM},
                    "subject": subject,
                    "content": [{"type": "text/plain", "value": body}],
                },
                timeout=10.0,
            )
            return _record(
                db,
                channel="email",
                recipient=to,
                subject=subject,
                body=body,
                provider="sendgrid",
                status="sent" if r.status_code < 300 else "failed",
                error=None if r.status_code < 300 else r.text,
                **ctx,
            )
        except Exception as e:
            log.exception("sendgrid send failed")
            return _record(db, channel="email", recipient=to, subject=subject, body=body, provider="sendgrid", status="failed", error=str(e), **ctx)
    log.info("[email->%s] %s\n%s", to, subject, body)
    return _record(db, channel="email", recipient=to, subject=subject, body=body, provider="console", status="sent", **ctx)


def _twilio_send(channel: str, to: str, body: str) -> tuple[bool, Optional[str], Optional[str]]:
    if not (TWILIO_SID and TWILIO_TOKEN):
        return False, None, "twilio not configured"
    from_ = TWILIO_FROM_WHATSAPP if channel == "whatsapp" else TWILIO_FROM_SMS
    if not from_:
        return False, None, "twilio FROM not set"
    if channel == "whatsapp" and not to.startswith("whatsapp:"):
        to = f"whatsapp:{to}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
    try:
        r = httpx.post(
            url,
            data={"From": from_, "To": to, "Body": body},
            auth=(TWILIO_SID, TWILIO_TOKEN),
            timeout=10.0,
        )
        if r.status_code >= 300:
            return False, None, r.text
        return True, r.json().get("sid"), None
    except Exception as e:
        return False, None, str(e)


def send_sms(db: Session, to: str, body: str, **ctx) -> NotificationLog:
    ok, sid, err = _twilio_send("sms", to, body)
    if ok:
        return _record(db, channel="sms", recipient=to, body=body, provider="twilio", provider_message_id=sid, status="sent", **ctx)
    if err and err != "twilio not configured":
        log.warning("twilio sms failed: %s", err)
    log.info("[sms->%s] %s", to, body)
    return _record(db, channel="sms", recipient=to, body=body, provider="console", status="sent", error=err, **ctx)


def send_whatsapp(db: Session, to: str, body: str, **ctx) -> NotificationLog:
    ok, sid, err = _twilio_send("whatsapp", to, body)
    if ok:
        return _record(db, channel="whatsapp", recipient=to, body=body, provider="twilio", provider_message_id=sid, status="sent", **ctx)
    if err and err != "twilio not configured":
        log.warning("twilio whatsapp failed: %s", err)
    log.info("[whatsapp->%s] %s", to, body)
    return _record(db, channel="whatsapp", recipient=to, body=body, provider="console", status="sent", error=err, **ctx)


def send_push(db: Session, expo_token: str, title: str, body: str, data: Optional[dict] = None, **ctx) -> NotificationLog:
    payload = {"to": expo_token, "title": title, "body": body, "data": data or {}}
    try:
        r = httpx.post(EXPO_PUSH_URL, json=payload, timeout=10.0)
        ok = r.status_code < 300
        return _record(
            db,
            channel="push",
            recipient=expo_token,
            subject=title,
            body=body,
            payload=data,
            provider="expo",
            status="sent" if ok else "failed",
            error=None if ok else r.text,
            **ctx,
        )
    except Exception as e:
        log.warning("expo push failed: %s", e)
        log.info("[push->%s] %s", expo_token, body)
        return _record(db, channel="push", recipient=expo_token, subject=title, body=body, payload=data, provider="console", status="sent", error=str(e), **ctx)


def notify_booking_received(db: Session, booking, venue, user_email: Optional[str], user_phone: Optional[str], whatsapp: Optional[str], expo_token: Optional[str]):
    from app.services import templates as tpl
    subject, body = tpl.booking_received(
        venue.name, booking.date, booking.time, booking.group_size, booking.request_type, booking.id,
    )
    if user_email:
        send_email(db, user_email, subject, body, user_id=booking.user_id, booking_id=booking.id)
    if user_phone:
        send_sms(db, user_phone, body, user_id=booking.user_id, booking_id=booking.id)
    if whatsapp:
        send_whatsapp(db, whatsapp, body, user_id=booking.user_id, booking_id=booking.id)
    if expo_token:
        send_push(db, expo_token, "Booking received", body, data={"booking_id": booking.id}, user_id=booking.user_id, booking_id=booking.id)


def notify_booking_status_change(db: Session, booking, venue, *, user_email: Optional[str], user_phone: Optional[str], expo_token: Optional[str] = None):
    """Send the right templated email/SMS/push when a booking transitions.

    Called after admin or partner updates a booking status. No-op for
    intermediate states (new -> pending) or unknown transitions.
    """
    from app.services import templates as tpl
    status = booking.status
    if status == "confirmed":
        subject, body = tpl.booking_confirmed(
            venue.name, booking.date, booking.time, booking.group_size,
            venue.dress_code, booking.venue_response, booking.id,
        )
    elif status == "rejected":
        subject, body = tpl.booking_rejected(venue.name, booking.venue_response, booking.id)
    elif status == "cancelled":
        subject, body = tpl.booking_cancelled(venue.name, booking.id)
    else:
        return
    if user_email:
        send_email(db, user_email, subject, body, user_id=booking.user_id, booking_id=booking.id)
    if user_phone:
        send_sms(db, user_phone, body, user_id=booking.user_id, booking_id=booking.id)
    if expo_token:
        send_push(db, expo_token, subject, body, data={"booking_id": booking.id, "status": status}, user_id=booking.user_id, booking_id=booking.id)
