"""Welcome email — sent once when a restaurant completes onboarding.

The first concrete artifact a restaurant gets from SavoryMind: their
booking link, a sample WhatsApp message they can paste, and a clear
explanation of what happens next. Fires exactly once, when
`onboarding_completed` flips from False/None → True on a restaurant
account that has a slug (slug is auto-assigned during the same PATCH,
so it's always present by the time we get here).
"""
from __future__ import annotations

from html import escape

from ..core.config import settings
from ..models.user import User
from . import resend_client, email_templates


def send_restaurant_welcome(user: User) -> None:
    """Fire-and-forget welcome email. Caller is the auth profile PATCH,
    which holds the only place where a restaurant transitions to
    onboarding_completed=True. No-op without an email address or slug.
    """
    if not user or not user.email or not user.slug:
        return
    if user.account_type != "restaurant":
        return

    lang = (user.language or "en")
    rest_name = user.restaurant_name or user.display_name or "your restaurant"
    link = f"{settings.frontend_url.rstrip('/')}/r/{user.slug}"
    dashboard = f"{settings.frontend_url.rstrip('/')}/restaurant/bookings"

    subject = email_templates.welcome_subject(lang, rest_name=rest_name)
    intro = email_templates.welcome_intro(lang, rest_name=rest_name)
    link_section = email_templates.welcome_link_section(lang)
    sample_heading = email_templates.welcome_sample_message_heading(lang)
    sample_body = email_templates.welcome_sample_message_body(lang, link=link)
    what_next = email_templates.welcome_what_next(lang)
    cta = email_templates.open_dashboard_cta(lang)
    footer = email_templates.email_footer(lang, dashboard_url=dashboard)

    safe_link = escape(link)
    safe_sample = escape(sample_body)

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:20px;margin:0 0 12px;">{escape(intro)}</h1>
      <p style="font-size:14px;color:#4b5563;margin:0 0 16px;line-height:1.5;">{escape(link_section)}</p>
      <p style="margin:16px 0;">
        <a href="{safe_link}" style="font-size:16px;color:#ea580c;font-weight:600;text-decoration:none;word-break:break-all;">{safe_link}</a>
      </p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:24px 0;">
        <p style="font-size:12px;font-weight:600;color:#ea580c;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">{escape(sample_heading)}</p>
        <p style="font-size:14px;color:#1f2937;margin:0;line-height:1.5;">{safe_sample}</p>
      </div>
      <p style="font-size:13px;color:#4b5563;margin:24px 0;line-height:1.5;">{escape(what_next)}</p>
      <p style="margin:24px 0;">
        <a href="{dashboard}" style="background:#ea580c;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">{escape(cta)}</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;">{footer}</p>
    </div>
    """.strip()

    resend_client.send_email(user.email, subject, html)
