"""Weekly digest email — Action Plan in the operator's inbox on Monday morning.

Audit's call: "Restaurant owners do not just want data. They want decisions...
Every dashboard should answer: What should I do today to make more money?"

Once a week the operator gets the same Action Plan they'd see on the
dashboard, plus a 7-day attribution rollup (menu SMS sent / clicks /
bookings driven). If the rollup is all zeros the email is still useful
because of the action plan; if the action plan is empty too (brand-new
restaurant) the email is skipped — no point waking them up to "nothing
to do."
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from html import escape

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.config import settings
from ..models.restaurant_ext import Booking, MenuBroadcast
from ..models.user import User
from . import action_plan_service, email_templates, resend_client


def send_weekly_digests(db: Session, *, today: date | None = None) -> dict:
    if today is None:
        today = date.today()

    restaurants = (
        db.query(User)
        .filter(
            User.account_type == "restaurant",
            User.onboarding_completed.is_(True),
        )
        .all()
    )

    sent = 0
    skipped_no_actions = 0
    skipped_no_email = 0

    for rest in restaurants:
        if not rest.email:
            skipped_no_email += 1
            continue
        actions = action_plan_service.build_action_plan(db, rest, today=today)
        if not actions:
            skipped_no_actions += 1
            continue
        _send_one(db, rest, actions, today)
        sent += 1

    return {
        "candidates": len(restaurants),
        "sent": sent,
        "skipped_no_actions": skipped_no_actions,
        "skipped_no_email": skipped_no_email,
    }


def _broadcast_stats(db: Session, user_id: int, today: date) -> dict:
    cutoff = today - timedelta(days=6)
    totals = (
        db.query(
            func.coalesce(func.sum(MenuBroadcast.sms_count), 0),
            func.coalesce(func.sum(MenuBroadcast.click_count), 0),
            func.count(MenuBroadcast.id),
        )
        .filter(MenuBroadcast.user_id == user_id, MenuBroadcast.local_date >= cutoff)
        .one()
    )
    sms, clicks, rounds = (int(x or 0) for x in totals)
    bookings = (
        db.query(func.count(Booking.id))
        .join(MenuBroadcast, MenuBroadcast.id == Booking.menu_broadcast_id)
        .filter(MenuBroadcast.user_id == user_id, MenuBroadcast.local_date >= cutoff)
        .scalar() or 0
    )
    return {"rounds": rounds, "sms": sms, "clicks": clicks, "bookings": int(bookings)}


def _send_one(db: Session, rest: User, actions: list[dict], today: date) -> None:
    lang = rest.language or "en"
    dashboard = f"{settings.frontend_url.rstrip('/')}/restaurant/bookings"
    rest_label = rest.restaurant_name or rest.display_name or "your restaurant"
    stats = _broadcast_stats(db, rest.id, today)
    labels = email_templates.weekly_digest_labels(lang)
    cta = email_templates.open_dashboard_cta(lang)
    footer = email_templates.email_footer(lang, dashboard_url=dashboard)
    subject = email_templates.weekly_digest_subject(lang, rest_name=rest_label)

    action_rows = "".join(
        f"""
        <a href="{settings.frontend_url.rstrip('/')}{escape(a['cta_route'])}"
           style="display:block;text-decoration:none;color:#111827;
                  background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;
                  padding:12px 14px;margin-bottom:8px;">
          <span style="font-size:18px;margin-right:6px;">{escape(a['icon'])}</span>
          <strong style="font-size:13px;">{escape(a['title'])}</strong>
          <span style="font-size:11px;color:#6b7280;display:block;margin-top:4px;">
            {escape(a['body'])}
            {'· <span style="color:#15803d;font-weight:600;">+$' + f"{a['estimated_gain']:.0f}" + '</span>' if a.get('estimated_gain', 0) > 0 else ''}
          </span>
        </a>
        """
        for a in actions
    )

    stats_block = ""
    if stats["rounds"] > 0:
        stats_block = f"""
        <div style="margin:24px 0 8px;padding:16px;background:#fff7ed;
                    border:1px solid #fed7aa;border-radius:12px;">
          <p style="font-size:11px;font-weight:700;color:#ea580c;
                    text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">
            {escape(labels['stats_heading'])}
          </p>
          <p style="font-size:13px;color:#1f2937;margin:0;line-height:1.6;">
            <strong>{stats['sms']}</strong> {escape(labels['sms'])} ·
            <strong>{stats['clicks']}</strong> {escape(labels['clicks'])} ·
            <strong>{stats['bookings']}</strong> {escape(labels['bookings'])}
          </p>
        </div>
        """

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <p style="font-size:11px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">
        {escape(labels['eyebrow'])}
      </p>
      <h1 style="font-size:20px;margin:0 0 12px;">{escape(labels['heading'])}</h1>
      <p style="font-size:13px;color:#4b5563;margin:0 0 16px;line-height:1.6;">
        {escape(labels['intro'].format(rest=rest_label))}
      </p>
      <div style="margin:16px 0;">
        {action_rows}
      </div>
      {stats_block}
      <p style="margin:24px 0;">
        <a href="{dashboard}" style="background:#ea580c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">{escape(cta)}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">{footer}</p>
    </div>
    """.strip()

    resend_client.send_email(rest.email, subject, html)
