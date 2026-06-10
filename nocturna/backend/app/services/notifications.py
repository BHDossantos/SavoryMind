"""Multi-channel notification dispatcher (email, SMS, WhatsApp, push).

Defaults to console logging when provider keys are absent so the app runs
locally without external dependencies. In production, set the env vars below.
"""
from __future__ import annotations

import base64
import json
import logging
import os
from dataclasses import dataclass
from typing import Iterable, Optional

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


@dataclass
class EmailAttachment:
    """A single attachment for send_email.

    `content` is raw bytes — we base64-encode it when building the
    SendGrid payload, and just note its presence in the console fallback.
    """
    filename: str
    content: bytes
    mime_type: str = "application/octet-stream"
    disposition: str = "attachment"


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


def send_email(
    db: Session,
    to: str,
    subject: str,
    body: str,
    *,
    attachments: Optional[Iterable[EmailAttachment]] = None,
    **ctx,
) -> NotificationLog:
    """Send an email through SendGrid (or console-fallback). Attachments
    are passed straight through to SendGrid's `attachments` array; the
    console fallback logs their filenames + sizes.
    """
    atts = list(attachments) if attachments else []

    if SENDGRID_KEY:
        payload: dict = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": SENDGRID_FROM},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
        }
        if atts:
            payload["attachments"] = [
                {
                    "filename": a.filename,
                    "content": base64.b64encode(a.content).decode("ascii"),
                    "type": a.mime_type,
                    "disposition": a.disposition,
                }
                for a in atts
            ]
        try:
            r = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {SENDGRID_KEY}", "Content-Type": "application/json"},
                json=payload,
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

    if atts:
        att_summary = ", ".join(f"{a.filename} ({len(a.content)}B)" for a in atts)
        log.info("[email->%s] %s\n%s\n[attachments: %s]", to, subject, body, att_summary)
        # Record attachment info into payload so the admin notifications log
        # can render it for debugging.
        return _record(
            db,
            channel="email",
            recipient=to,
            subject=subject,
            body=body,
            payload={"attachments": [{"filename": a.filename, "size": len(a.content), "type": a.mime_type} for a in atts]},
            provider="console",
            status="sent",
            **ctx,
        )
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
    intermediate states (new -> pending) or unknown transitions. On a
    `confirmed` transition the email gets an .ics calendar attachment
    so users can add the booking to their phone calendar with one tap.
    """
    from app.services import calendar as ics
    from app.services import templates as tpl
    status = booking.status
    email_attachments: list[EmailAttachment] = []

    if status == "confirmed":
        subject, body = tpl.booking_confirmed(
            venue.name, booking.date, booking.time, booking.group_size,
            venue.dress_code, booking.venue_response, booking.id,
        )
        try:
            ics_text = ics.build_ics(
                booking_id=booking.id,
                venue_name=venue.name,
                venue_address=venue.address,
                booking_date=booking.date,
                booking_time=booking.time,
                group_size=booking.group_size,
                request_type=booking.request_type,
                dress_code=venue.dress_code,
                plan_label=None,  # plan label is fetched lazily — keep this hot path cheap
            )
            email_attachments.append(EmailAttachment(
                filename=f"nocturna-booking-{booking.id}.ics",
                content=ics_text.encode("utf-8"),
                mime_type="text/calendar; charset=utf-8; method=PUBLISH",
            ))
        except ValueError as e:
            log.warning("could not build ICS for booking %s: %s", booking.id, e)
    elif status == "rejected":
        subject, body = tpl.booking_rejected(venue.name, booking.venue_response, booking.id)
    elif status == "cancelled":
        subject, body = tpl.booking_cancelled(venue.name, booking.id)
    else:
        return
    if user_email:
        send_email(
            db, user_email, subject, body,
            attachments=email_attachments or None,
            user_id=booking.user_id, booking_id=booking.id,
        )
    if user_phone:
        send_sms(db, user_phone, body, user_id=booking.user_id, booking_id=booking.id)
    if expo_token:
        send_push(db, expo_token, subject, body, data={"booking_id": booking.id, "status": status}, user_id=booking.user_id, booking_id=booking.id)
