"""Morning briefing email — today's bookings, one glance, before service.

Italian restaurant operators expect to see "what's the day look like" over
morning coffee, not by opening a web app. Cloud Scheduler hits
POST /internal/jobs/daily-briefing once a day (Europe/Rome 8am for the
pilot); this service finds each restaurant with bookings today and sends
them a one-screen summary email in their language.

Idempotency comes from the scheduler running once per day — if it
double-fires by accident, restaurants get a duplicate briefing.
Acceptable for the pilot; we can add a date-keyed dedup column later
if the failure mode actually materialises.
"""
from __future__ import annotations

from datetime import date, timedelta
from html import escape

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.user import User
from ..models.restaurant_ext import Booking, MenuBroadcast
from . import resend_client, email_templates


def send_daily_briefings(db: Session, today: date | None = None) -> dict:
    """Send one summary email per onboarded restaurant that has bookings today."""
    if today is None:
        today = date.today()

    # Pull today's confirmed bookings in one query; group by restaurant.
    bookings = (
        db.query(Booking)
        .filter(Booking.date == today, Booking.status.in_(["confirmed", "seated"]))
        .order_by(Booking.user_id, Booking.time_slot)
        .all()
    )
    by_restaurant: dict[int, list[Booking]] = {}
    for b in bookings:
        by_restaurant.setdefault(b.user_id, []).append(b)

    sent = 0
    skipped_no_email = 0
    for restaurant_id, items in by_restaurant.items():
        restaurant = db.query(User).filter(User.id == restaurant_id).first()
        if not restaurant or not restaurant.email:
            skipped_no_email += 1
            continue
        menu_stats = _menu_broadcast_stats_7d(db, restaurant_id, today)
        _send_briefing(restaurant, items, today, menu_stats)
        sent += 1

    return {
        "restaurants_with_bookings": len(by_restaurant),
        "emails_sent":               sent,
        "skipped_no_email":          skipped_no_email,
        "total_bookings":            len(bookings),
    }


def _menu_broadcast_stats_7d(db: Session, user_id: int, today: date) -> dict:
    """7-day rollup of menu-of-the-day SMS broadcasts for this restaurant.

    Returns zeroed dict when the restaurant hasn't broadcast anything; the
    email-builder hides the whole section in that case so the briefing
    isn't cluttered with "0 / 0 / 0" before the feature has been used.
    """
    cutoff = today - timedelta(days=6)
    totals = (
        db.query(
            func.coalesce(func.sum(MenuBroadcast.sms_count), 0),
            func.coalesce(func.sum(MenuBroadcast.click_count), 0),
            func.count(MenuBroadcast.id),
        )
        .filter(
            MenuBroadcast.user_id == user_id,
            MenuBroadcast.local_date >= cutoff,
        )
        .one()
    )
    sms, clicks, rounds = totals
    bookings = (
        db.query(func.count(Booking.id))
        .join(MenuBroadcast, MenuBroadcast.id == Booking.menu_broadcast_id)
        .filter(
            MenuBroadcast.user_id == user_id,
            MenuBroadcast.local_date >= cutoff,
        )
        .scalar()
        or 0
    )
    return {"rounds": int(rounds), "sms": int(sms), "clicks": int(clicks), "bookings": int(bookings)}


def _send_briefing(
    restaurant: User, bookings: list[Booking], today: date, menu_stats: dict | None = None,
) -> None:
    lang = (restaurant.language or "en")
    dashboard = f"{settings.frontend_url.rstrip('/')}/restaurant/bookings"
    total_covers = sum(b.party_size for b in bookings)

    subject = email_templates.briefing_subject(lang, count=len(bookings), date=str(today))
    intro = email_templates.briefing_intro(lang, count=len(bookings), covers=total_covers)
    labels = email_templates.briefing_labels(lang)
    cta = email_templates.open_dashboard_cta(lang)
    footer = email_templates.email_footer(lang, dashboard_url=dashboard)

    rows = "".join(
        f'<tr>'
        f'<td style="padding:8px 12px;color:#111827;font-weight:600;">{escape(b.time_slot or "")}</td>'
        f'<td style="padding:8px 12px;color:#111827;">{escape(b.customer_name or "")}</td>'
        f'<td style="padding:8px 12px;color:#6b7280;">{escape(str(b.party_size))}</td>'
        f'<td style="padding:8px 12px;color:#9ca3af;font-size:12px;">{escape(b.notes or "")}</td>'
        f'</tr>'
        for b in bookings
    )

    menu_block = ""
    if menu_stats and menu_stats.get("rounds", 0) > 0:
        menu_labels = email_templates.menu_broadcast_summary_labels(lang)
        menu_block = f"""
      <div style="margin:24px 0 8px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
        <p style="font-size:12px;font-weight:600;color:#ea580c;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">{escape(menu_labels["heading"])}</p>
        <p style="font-size:13px;color:#1f2937;margin:0;line-height:1.6;">
          <strong>{menu_stats["sms"]}</strong> {escape(menu_labels["sms"])} ·
          <strong>{menu_stats["clicks"]}</strong> {escape(menu_labels["clicks"])} ·
          <strong>{menu_stats["bookings"]}</strong> {escape(menu_labels["bookings"])}
        </p>
      </div>
        """
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:18px;margin:0 0 12px;">{escape(intro)}</h1>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;margin:16px 0;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">{escape(labels["time"])}</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">{escape(labels["guest"])}</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">{escape(labels["party"])}</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">{escape(labels["notes"])}</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      {menu_block}
      <p style="margin:24px 0;">
        <a href="{dashboard}" style="background:#ea580c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">{escape(cta)}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">{footer}</p>
    </div>
    """.strip()

    resend_client.send_email(restaurant.email, subject, html)
