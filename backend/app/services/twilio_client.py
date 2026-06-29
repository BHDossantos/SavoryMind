"""Twilio SMS client wrapper.

Same shape as `resend_client`: every backend feature that wants to send
SMS goes through this helper. No-op when unconfigured, never raises,
returns True/False to the caller.

Configuration:
  TWILIO_ACCOUNT_SID   — if unset, send_sms is a no-op returning False
  TWILIO_AUTH_TOKEN    — required alongside ACCOUNT_SID
  TWILIO_FROM_PHONE    — sender number (E.164, e.g. "+15555550100")
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return all([
        os.getenv("TWILIO_ACCOUNT_SID"),
        os.getenv("TWILIO_AUTH_TOKEN"),
        os.getenv("TWILIO_FROM_PHONE"),
    ])


def send_sms(to: str, body: str) -> bool:
    """Send an SMS. Returns True on success, False on any failure
    (including unconfigured creds or invalid recipient). Never raises."""
    if not is_configured():
        logger.info("twilio not configured — skipping SMS send")
        return False

    if not to or not to.strip():
        logger.info("twilio: skipping empty recipient")
        return False

    # Trim and require E.164 (+countrycode...). Twilio rejects other formats
    # with a paid API error, so fail fast and silently locally.
    to_clean = to.strip()
    if not to_clean.startswith("+") or not to_clean[1:].replace(" ", "").replace("-", "").isdigit():
        logger.info("twilio: skipping non-E.164 recipient %r", to_clean)
        return False

    try:
        from twilio.rest import Client  # third-party SDK
        client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
        client.messages.create(
            to=to_clean,
            from_=os.getenv("TWILIO_FROM_PHONE"),
            body=body,
        )
        return True
    except ImportError:
        logger.warning("twilio SDK not installed — SMS skipped")
        return False
    except Exception as exc:
        # Sanitize: log only the exception class. Body or full str(exc) may
        # contain the auth token in some SDK versions.
        logger.warning("twilio send failed for %s: %s", to_clean, type(exc).__name__)
        return False
