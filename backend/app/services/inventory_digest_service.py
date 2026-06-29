"""Weekly low-stock inventory digest job.

Triggered once per hour by Cloud Scheduler on Mondays. For each
restaurant, computes their LOCAL hour. If it's currently 8am-Mon in
their timezone AND they have items below par, fires:

  1. ONE in-app Notification row (idempotent within the ISO week)
  2. ONE Resend email per restaurant (skipped silently when
     RESEND_API_KEY unset OR recipient is a social-login placeholder)

Hourly trigger + per-user TZ filter is what lets a single global cron
serve restaurants across every timezone. Single trigger at 8am UTC
would fire too early for Auckland and never for LA.

Idempotency contract: re-running the same hour MUST NOT spam users.
Dedup key = (user_id, current_iso_week_in_user_tz). On collision we
UPDATE the existing notification's message + reset read=False rather
than INSERT a new row. Test `test_digest_idempotent_within_same_week`
exercises this.

This module is a peer of resend_client / claude_client — pure service
logic, importable from both the route handler and from a manual ops
shell.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from ..models.notification import Notification
from ..models.user import User
from . import inventory_service, resend_client

logger = logging.getLogger(__name__)


_NOTIFICATION_LINK   = "/restaurant/inventory"
_NOTIFICATION_PREFIX = "Weekly inventory digest:"


def _local_now(user_tz: str, now_utc: datetime) -> datetime:
    """Convert UTC timestamp into the user's local time. Falls back to
    UTC if the user's timezone string is invalid."""
    try:
        tz = ZoneInfo(user_tz or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
    return now_utc.astimezone(tz)


def _is_digest_window(local: datetime) -> bool:
    """True iff local time is Monday between 08:00 and 09:00."""
    return local.weekday() == 0 and local.hour == 8


def _iso_week_start_utc(local_now: datetime) -> datetime:
    """Monday 00:00 of the current ISO week, normalized to UTC. Used as
    the idempotency key boundary."""
    monday_local = local_now - _timedelta_days(local_now.weekday())
    monday_local = monday_local.replace(hour=0, minute=0, second=0, microsecond=0)
    return monday_local.astimezone(timezone.utc)


def _timedelta_days(n):
    from datetime import timedelta
    return timedelta(days=n)


def _build_message(items: list[dict]) -> str:
    """Plain-text notification body: '12 items below par — Cabernet (3/6 bottles), …'"""
    n = len(items)
    if n == 0:
        return f"{_NOTIFICATION_PREFIX} all stock above par 🎉"

    head = f"{_NOTIFICATION_PREFIX} {n} item{'s' if n != 1 else ''} below par"
    sample = ", ".join(
        f"{i['name']} ({i['current_quantity']:g}/{i['par_level']:g} {i['unit']})"
        for i in items[:5]
    )
    tail = "" if n <= 5 else f" — and {n - 5} more"
    return f"{head} — {sample}{tail}"


def _build_email_html(items: list[dict], dashboard_url: str) -> str:
    """Lightweight HTML; no template engine. ~30 row cap to keep digest
    skim-able. Sorted by category then name."""
    items = sorted(items, key=lambda i: (i["category"], i["name"]))[:30]
    rows = "".join(
        f"<tr>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #eee'>{i['name']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #eee;color:#666'>{i['category']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #eee;text-align:right'>"
        f"{i['current_quantity']:g} / {i['par_level']:g} {i['unit']}</td>"
        f"</tr>"
        for i in items
    )
    n = len(items)
    return f"""
<html><body style="font-family:system-ui,sans-serif;color:#222;max-width:560px;margin:0 auto">
  <h2 style="margin-bottom:8px">Your weekly inventory check</h2>
  <p style="color:#555;margin-top:0">{n} item{'s' if n != 1 else ''} below par level. Time to reorder.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="text-align:left;color:#888;font-size:12px;text-transform:uppercase">
        <th style="padding:6px 12px">Item</th>
        <th style="padding:6px 12px">Category</th>
        <th style="padding:6px 12px;text-align:right">Current / Par</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
  <p style="margin-top:24px"><a href="{dashboard_url}" style="background:#333;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">View inventory dashboard</a></p>
  <p style="color:#888;font-size:12px;margin-top:32px">Sent because you have inventory items configured for SavoryMind. Adjust your par levels in the inventory page if these alerts feel off.</p>
</body></html>
""".strip()


def _find_existing_notification(db: Session, user_id: int, week_start_utc: datetime) -> Optional[Notification]:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.link == _NOTIFICATION_LINK,
            Notification.message.like(f"{_NOTIFICATION_PREFIX}%"),
            Notification.created_at >= week_start_utc,
        )
        .order_by(Notification.created_at.desc())
        .first()
    )


def run_digest(db: Session, now: Optional[datetime] = None,
               dashboard_base_url: str = "https://savorymind.net") -> dict:
    """Process all restaurants. Returns stats dict."""
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        # Tests pass naive UTC; normalize.
        now = now.replace(tzinfo=timezone.utc)

    stats = {
        "restaurants_processed":   0,
        "notifications_created":   0,
        "notifications_updated":   0,
        "emails_sent":             0,
        "skipped_no_low_stock":    0,
        "skipped_wrong_time":      0,
    }

    restaurants = (
        db.query(User)
        .filter(User.account_type == "restaurant")
        .all()
    )

    for user in restaurants:
        local = _local_now(user.timezone or "UTC", now)
        if not _is_digest_window(local):
            stats["skipped_wrong_time"] += 1
            continue

        items = inventory_service.get_low_stock_items(db, user.id)
        if not items:
            stats["skipped_no_low_stock"] += 1
            continue

        stats["restaurants_processed"] += 1

        message = _build_message(items)
        week_start = _iso_week_start_utc(local)
        existing = _find_existing_notification(db, user.id, week_start)

        if existing is None:
            db.add(Notification(
                user_id=user.id,
                message=message,
                link=_NOTIFICATION_LINK,
                read=False,
            ))
            stats["notifications_created"] += 1
        else:
            existing.message = message
            existing.read = False
            stats["notifications_updated"] += 1

        db.commit()

        if user.email and resend_client.is_configured():
            ok = resend_client.send_email(
                to=user.email,
                subject=f"Inventory check: {len(items)} items below par",
                html=_build_email_html(items, f"{dashboard_base_url}/restaurant/inventory"),
            )
            if ok:
                stats["emails_sent"] += 1

    return stats
