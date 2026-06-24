"""Menu-of-the-day SMS broadcast.

Restaurants publish today's menu (a few lines of text) via the restaurant
dashboard; this service broadcasts it once per day to every CRM customer
who has explicitly opted in (`menu_sms_opt_in == True`) and given a
phone number. Cloud Scheduler hits POST /internal/jobs/menu-of-the-day
hourly; the service finds restaurants whose local time is inside the
broadcast window and fires the SMS round.

Idempotency: User.menu_sms_last_sent_date is set to today-in-local-tz
once a restaurant has been broadcast for the day, so re-runs (or hourly
ticks that all fall inside the same window) are no-ops.

Privacy / cost guards: customers without phone numbers, without opt-in,
or with a blank menu are skipped silently. Menu bodies are length-clamped
so a verbose menu can't spike the SMS bill via multi-segment messages.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.restaurant_ext import CRMCustomer
from ..models.user import User
from . import email_templates, twilio_client

logger = logging.getLogger(__name__)


# Local-time window in which the broadcast fires. 11am restaurant-local
# is the sweet spot for lunch decisions — early enough to influence
# where the diner eats, late enough not to wake them up. The window is
# 1 hour wide so an hourly cron with mild jitter never misses it.
BROADCAST_HOUR_LO = 11
BROADCAST_HOUR_HI = 11

# Twilio bills per 160-char (GSM-7) or 70-char (UCS-2) segment. Capping the
# menu body keeps the SMS at 1–2 segments for typical Italian menus.
MAX_MENU_BODY_CHARS = 300


def _restaurant_local_now(restaurant: User, now: datetime) -> datetime:
    tz_name = restaurant.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    return now.astimezone(tz)


def _in_broadcast_window(local_now: datetime) -> bool:
    return BROADCAST_HOUR_LO <= local_now.hour <= BROADCAST_HOUR_HI


def _clamp_menu(menu: str) -> str:
    menu = (menu or "").strip()
    if len(menu) <= MAX_MENU_BODY_CHARS:
        return menu
    # Cut to limit and leave a visible ellipsis so customers know to come
    # see the full thing — not silently truncated.
    return menu[: MAX_MENU_BODY_CHARS - 1].rstrip() + "…"


def send_due_menus(db: Session, *, now: datetime | None = None) -> dict:
    """Broadcast today's menu to opted-in CRM customers for every
    restaurant whose local time is currently inside the broadcast window
    and whose menu hasn't yet been sent today.

    Safe to call repeatedly (idempotent via menu_sms_last_sent_date)."""
    if now is None:
        now = datetime.now(timezone.utc)

    # Pull every restaurant that has a non-empty menu. The local-time and
    # idempotency filters are applied in Python because they depend on the
    # restaurant's individual timezone — a single SQL filter can't express
    # "11am Europe/Rome AND 11am America/New_York" at the same UTC instant.
    candidates = (
        db.query(User)
        .filter(
            User.account_type == "restaurant",
            User.menu_of_the_day.isnot(None),
            User.menu_of_the_day != "",
        )
        .all()
    )

    restaurants_broadcast = 0
    restaurants_skipped_window = 0
    restaurants_skipped_already_sent = 0
    sms_sent = 0
    customers_skipped_no_opt_in = 0
    customers_skipped_no_phone = 0

    for restaurant in candidates:
        local_now = _restaurant_local_now(restaurant, now)
        today_local = local_now.date()

        if restaurant.menu_sms_last_sent_date == today_local:
            restaurants_skipped_already_sent += 1
            continue

        if not _in_broadcast_window(local_now):
            restaurants_skipped_window += 1
            continue

        rest_label = (
            restaurant.restaurant_name
            or restaurant.display_name
            or "the restaurant"
        )
        lang = restaurant.language or "en"
        booking_url = None
        if restaurant.slug:
            booking_url = f"{settings.frontend_url.rstrip('/')}/r/{restaurant.slug}"
        body = email_templates.menu_of_the_day_sms(
            lang,
            rest_label=rest_label,
            menu_body=_clamp_menu(restaurant.menu_of_the_day),
            booking_url=booking_url,
        )

        # Fetch opted-in customers for this restaurant.
        customers = (
            db.query(CRMCustomer)
            .filter(
                CRMCustomer.user_id == restaurant.id,
            )
            .all()
        )

        sent_for_this_restaurant = 0
        for c in customers:
            if not c.menu_sms_opt_in:
                customers_skipped_no_opt_in += 1
                continue
            if not c.phone or not c.phone.strip():
                customers_skipped_no_phone += 1
                continue
            if twilio_client.send_sms(c.phone, body):
                sent_for_this_restaurant += 1

        sms_sent += sent_for_this_restaurant
        restaurants_broadcast += 1
        # Mark sent even if 0 customers were opted in — the restaurant has
        # been "processed" for today and we don't want to retry every hour.
        restaurant.menu_sms_last_sent_date = today_local

    db.commit()

    stats = {
        "restaurants_broadcast":            restaurants_broadcast,
        "restaurants_skipped_window":       restaurants_skipped_window,
        "restaurants_skipped_already_sent": restaurants_skipped_already_sent,
        "sms_sent":                         sms_sent,
        "customers_skipped_no_opt_in":      customers_skipped_no_opt_in,
        "customers_skipped_no_phone":       customers_skipped_no_phone,
    }
    return stats
