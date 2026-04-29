"""Plain-text email + WhatsApp templates for booking + payment lifecycle.

Centralised so subject + body wording stays consistent across the codebase
and is easy to translate (i18n later).
"""
from __future__ import annotations

from typing import Optional


def booking_received(venue_name: str, date: str, time: str, group_size: int, request_type: str, booking_id: int) -> tuple[str, str]:
    subject = f"Nocturna · we received your booking at {venue_name}"
    body = (
        f"Ciao,\n\n"
        f"We've received your booking request:\n\n"
        f"  · {venue_name}\n"
        f"  · {date} at {time}\n"
        f"  · {group_size} guest(s)\n"
        f"  · {request_type.replace('_',' ')}\n\n"
        f"Booking ref: #{booking_id}\n\n"
        f"Our concierge will confirm with the venue shortly and write back.\n"
        f"Talk soon,\nNocturna"
    )
    return subject, body


def booking_confirmed(venue_name: str, date: str, time: str, group_size: int, dress_code: Optional[str], note: Optional[str], booking_id: int) -> tuple[str, str]:
    subject = f"Nocturna · confirmed at {venue_name} ✓"
    body = (
        f"You're confirmed for {venue_name} on {date} at {time} ({group_size} ppl).\n"
    )
    if dress_code:
        body += f"Dress code: {dress_code}.\n"
    if note:
        body += f"\nFrom the venue: {note}\n"
    body += f"\nRef #{booking_id}. See you tonight.\nNocturna"
    return subject, body


def booking_rejected(venue_name: str, reason: Optional[str], booking_id: int) -> tuple[str, str]:
    subject = f"Nocturna · {venue_name} couldn't accommodate"
    body = (
        f"Sorry — {venue_name} couldn't take your request.\n"
    )
    if reason:
        body += f"Reason: {reason}\n"
    body += (
        f"\nWe'd love to find you an alternative. Reply to this email or open the app to "
        f"regenerate the plan with a different vibe or time.\n\n"
        f"Ref #{booking_id}\nNocturna"
    )
    return subject, body


def booking_reminder(venue_name: str, time: str, address: Optional[str], dress_code: Optional[str], booking_id: int) -> tuple[str, str]:
    subject = f"Nocturna · tonight at {venue_name} ({time})"
    body = (
        f"Quick reminder — your Nocturna booking is in 1 hour.\n\n"
        f"  · {venue_name}\n"
        f"  · {time}\n"
    )
    if address:
        body += f"  · {address}\n"
    if dress_code:
        body += f"  · Dress: {dress_code}\n"
    body += f"\nRef #{booking_id}. Have a great night.\nNocturna"
    return subject, body


def booking_cancelled(venue_name: str, booking_id: int) -> tuple[str, str]:
    subject = f"Nocturna · cancelled — {venue_name}"
    body = (
        f"Your booking at {venue_name} has been cancelled. If this wasn't you, "
        f"reply to this email and we'll sort it.\n\nRef #{booking_id}\nNocturna"
    )
    return subject, body


def payment_receipt(label: str, amount_eur: float, currency: str, payment_id: int, receipt_url: Optional[str]) -> tuple[str, str]:
    subject = f"Nocturna · receipt — {label} (€{amount_eur:.2f})"
    body = (
        f"Thanks — your payment is confirmed.\n\n"
        f"  · {label}\n"
        f"  · {currency.upper()} {amount_eur:.2f}\n"
        f"  · Receipt #{payment_id}\n"
    )
    if receipt_url:
        body += f"\nDetailed receipt: {receipt_url}\n"
    body += "\nNocturna"
    return subject, body


def payment_failed(label: str, amount_eur: float, reason: Optional[str], payment_id: int) -> tuple[str, str]:
    subject = f"Nocturna · payment didn't go through"
    body = (
        f"Your payment of €{amount_eur:.2f} for {label} couldn't be processed.\n"
    )
    if reason:
        body += f"Reason: {reason}\n"
    body += (
        f"\nNo charge was made. Try again from the app, or reply here for help.\n\n"
        f"Ref #{payment_id}\nNocturna"
    )
    return subject, body


def subscription_active(tier: str, period_end: Optional[str]) -> tuple[str, str]:
    subject = f"Nocturna · {tier} active"
    body = (
        f"Welcome to {tier}. You now have access to premium plans, hidden gems, "
        f"and concierge bookings.\n"
    )
    if period_end:
        body += f"Renews on {period_end}.\n"
    body += "\nEnjoy your nights.\nNocturna"
    return subject, body
