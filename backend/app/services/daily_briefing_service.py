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

from datetime import date
from html import escape

from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.user import User
from ..models.restaurant_ext import Booking
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
        _send_briefing(restaurant, items, today)
        sent += 1

    return {
        "restaurants_with_bookings": len(by_restaurant),
        "emails_sent":               sent,
        "skipped_no_email":          skipped_no_email,
        "total_bookings":            len(bookings),
    }


def _send_briefing(restaurant: User, bookings: list[Booking], today: date) -> None:
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
      <p style="margin:24px 0;">
        <a href="{dashboard}" style="background:#ea580c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">{escape(cta)}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">{footer}</p>
    </div>
    """.strip()

    resend_client.send_email(restaurant.email, subject, html)
