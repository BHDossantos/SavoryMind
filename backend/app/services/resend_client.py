"""Resend email client wrapper.

Why this exists: every backend feature that wants to send transactional
mail goes through one helper that handles SDK setup, no-op-when-unset,
and exception sanitization. Same shape as `claude_client` — caller
gets True/False back, no raises.

Configuration:
  RESEND_API_KEY      — if unset, send_email is a no-op returning False
  RESEND_FROM_ADDRESS — defaults to 'Savorymind <noreply@savorymind.net>'
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


_DEFAULT_FROM = "Savorymind <noreply@savorymind.net>"


def is_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))


def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email. Returns True on success, False on
    any failure (including unconfigured key). Never raises."""
    if not is_configured():
        logger.info("resend not configured — skipping email send")
        return False

    if not to or "@" not in to:
        logger.info("resend: skipping invalid recipient %r", to)
        return False

    # Suppress sends to social-login placeholder addresses (e.g.
    # "spotify_12345@social") that don't correspond to real mailboxes.
    if to.endswith("@social"):
        return False

    try:
        import resend  # third-party SDK
        resend.api_key = os.getenv("RESEND_API_KEY")
        from_addr = os.getenv("RESEND_FROM_ADDRESS", _DEFAULT_FROM)
        resend.Emails.send({
            "from":    from_addr,
            "to":      to,
            "subject": subject,
            "html":    html,
        })
        return True
    except ImportError:
        # The `resend` package isn't installed in test envs — that's fine,
        # we degrade silently.
        logger.warning("resend SDK not installed — email skipped")
        return False
    except Exception as exc:
        # Sanitize: log only the exception class name + recipient. Body
        # may contain secrets; full str(exc) might include the API key
        # in some SDK versions.
        logger.warning("resend send failed for %s: %s", to, type(exc).__name__)
        return False
