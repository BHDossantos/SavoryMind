"""Internal job triggers — invoked by Cloud Scheduler, not user clients.

Auth model: every endpoint here verifies an OIDC token issued by Google
to the configured scheduler service account, with audience matching the
endpoint URL. Public clients are 401'd immediately.

Mounted under /internal (NOT /api) so it never appears in client API
docs and isn't accidentally exposed via mobile/web routing.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.rate_limit import limiter
from ...services import inventory_digest_service, reminder_service, daily_briefing_service

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/internal/jobs", tags=["internal-jobs"])


def _verify_scheduler_oidc(authorization: str) -> str:
    """Verify the bearer token is a Google OIDC token issued for the
    configured scheduler service account, with the expected audience.

    Returns the validated email claim. Raises HTTPException(401) on any
    failure mode — no specifics leaked to caller.

    Configuration:
      SCHEDULER_SERVICE_ACCOUNT — required service account email claim.
      SCHEDULER_AUDIENCE        — expected `aud`. Defaults to the
                                  endpoint URL.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed bearer token.")
    token = authorization.split(None, 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or malformed bearer token.")

    expected_email = os.getenv("SCHEDULER_SERVICE_ACCOUNT", "").strip()
    expected_audience = os.getenv("SCHEDULER_AUDIENCE", "").strip()
    if not expected_email or not expected_audience:
        # Refuse to run if the operator hasn't wired the auth config.
        # This prevents the endpoint from accidentally being open in dev.
        logger.error("internal-jobs: SCHEDULER_SERVICE_ACCOUNT and SCHEDULER_AUDIENCE must both be set")
        raise HTTPException(status_code=401, detail="Endpoint not configured.")

    try:
        from google.oauth2 import id_token  # type: ignore
        from google.auth.transport import requests as google_requests  # type: ignore
        claims = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=expected_audience,
        )
    except ImportError:
        logger.error("internal-jobs: google.auth not installed")
        raise HTTPException(status_code=401, detail="Token verification unavailable.")
    except Exception as exc:
        logger.warning("internal-jobs: OIDC verify failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=401, detail="Invalid bearer token.")

    iss = claims.get("iss", "")
    if iss not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid token issuer.")
    if claims.get("email", "").lower() != expected_email.lower():
        raise HTTPException(status_code=401, detail="Token not issued to expected service account.")

    return claims.get("email", "")


def require_scheduler(
    authorization: str = Header(default=""),
) -> str:
    return _verify_scheduler_oidc(authorization)


@router.post("/inventory-digest")
@limiter.limit("60/minute")
def inventory_digest(
    request: Request,
    db: Session = Depends(get_db),
    _scheduler_email: str = Depends(require_scheduler),
):
    stats = inventory_digest_service.run_digest(db)
    logger.info("inventory-digest stats: %s", stats)
    return stats


@router.post("/booking-reminders")
@limiter.limit("60/minute")
def booking_reminders(
    request: Request,
    db: Session = Depends(get_db),
    _scheduler_email: str = Depends(require_scheduler),
):
    """Cron hook: send day-before reminders to diners with confirmed bookings.

    Designed to be hit every 15 minutes by Cloud Scheduler. Idempotent
    via Booking.reminder_sent_at, so overlapping ticks are safe."""
    stats = reminder_service.send_due_reminders(db)
    logger.info("booking-reminders stats: %s", stats)
    return stats


@router.post("/daily-briefing")
@limiter.limit("60/minute")
def daily_briefing(
    request: Request,
    db: Session = Depends(get_db),
    _scheduler_email: str = Depends(require_scheduler),
):
    """Cron hook: send each restaurant a morning briefing of today's bookings.

    Designed to be hit once per day by Cloud Scheduler — for the Italian
    pilot, schedule it at 07:00 UTC (08:00–09:00 Rome). Restaurants with
    no confirmed bookings today are skipped."""
    stats = daily_briefing_service.send_daily_briefings(db)
    logger.info("daily-briefing stats: %s", stats)
    return stats
