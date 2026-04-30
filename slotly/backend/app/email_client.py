"""Email send wrapper with stub mode for keyless dev/CI.

In stub mode (no RESEND_API_KEY) emails are not transmitted; the
notification row is the only record. Production uses Resend.
"""
from __future__ import annotations

import logging

import httpx

from .config import settings

logger = logging.getLogger("availablenow.email")


def is_stub_mode() -> bool:
    return not settings.resend_api_key


def send_email(*, to: str, subject: str, body_text: str) -> str:
    """Returns the provider message id (or "" in stub mode)."""
    if is_stub_mode():
        logger.info("STUB EMAIL to=%s subject=%r", to, subject)
        return ""

    payload = {
        "from": f"{settings.notifications_from_name} <{settings.notifications_from_email}>",
        "to": [to],
        "subject": subject,
        "text": body_text,
    }
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=10.0) as client:
        resp = client.post("https://api.resend.com/emails", json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("id", "")
