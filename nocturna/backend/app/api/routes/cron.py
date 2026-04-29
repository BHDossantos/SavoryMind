"""Cron-like endpoints, designed to be hit by Cloud Scheduler / GitHub Actions / etc.

Authentication is via shared secret in the X-Cron-Token header (or the
admin JWT). This is intentionally simple — Cloud Scheduler can attach
arbitrary headers, and admins can also kick reminders manually.
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_current_user_optional
from app.models import User
from app.services import reminders

router = APIRouter(prefix="/api/cron", tags=["cron"])

CRON_TOKEN = os.getenv("NOCTURNA_CRON_TOKEN")


def _authorize(token: Optional[str], user: Optional[User]) -> None:
    if user and user.role == "admin":
        return
    if CRON_TOKEN and token == CRON_TOKEN:
        return
    raise HTTPException(401, "Unauthorized — admin token or X-Cron-Token required")


@router.post("/reminders")
def reminders_due(
    x_cron_token: Optional[str] = Header(default=None, alias="X-Cron-Token"),
    lookahead_min: int = 60,
    window_min: int = 30,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """Send reminders for all bookings due in the next `lookahead_min` minutes.

    Designed to run every 15 minutes via Cloud Scheduler. Idempotent —
    each booking is reminded at most once.
    """
    _authorize(x_cron_token, user)
    return reminders.run_due(db, lookahead_min=lookahead_min, window_min=window_min)
