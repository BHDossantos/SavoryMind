"""Today's AI Action Plan — the restaurant operator's first-screen decisions.

The audit's central thesis: "AI should not just answer questions — AI should
create actions inside the app." This service rolls every signal we already
have (menu recommendations, booking calendar, food waste, menu broadcast
attribution, daily predictions) into a short list of "do these today" cards,
each with a one-click action and a dollar estimate.

Each Action is intentionally shaped for direct rendering — title, body,
icon, severity, cta_label, cta_route, estimated_gain. The frontend renders
a single component for any action, so adding a new action type costs zero
UI work.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.menu import MenuItem
from ..models.restaurant_ext import Booking, MenuBroadcast
from ..models.user import User
from . import menu_service, waste_service


# Severity drives the colour the card renders in. Keep this small —
# operators glaze over if everything is "URGENT."
SEV_HIGH = "high"
SEV_MEDIUM = "medium"
SEV_LOW = "low"


def _action(
    *, title: str, body: str, icon: str, severity: str,
    cta_label: str, cta_route: str, estimated_gain: float = 0.0, kind: str,
) -> dict[str, Any]:
    """Build one render-ready card. Kept as a plain dict so the frontend
    doesn't need to know about an Action class."""
    return {
        "kind":           kind,
        "title":          title,
        "body":           body,
        "icon":           icon,
        "severity":       severity,
        "cta_label":      cta_label,
        "cta_route":      cta_route,
        "estimated_gain": round(estimated_gain, 2),
    }


def _star_actions(db: Session, user_id: int) -> list[dict]:
    """Top performers worth promoting today. Pulls from the existing
    recommendations engine so the action plan stays in lockstep with
    /restaurant/predictions and /restaurant/marketing."""
    out: list[dict] = []
    recs = menu_service.get_recommendations(db, user_id)
    high_priority = [r for r in recs if r.get("priority") == "high"][:2]
    for r in high_priority:
        if r["type"] == "price_increase":
            out.append(_action(
                kind="price_increase",
                title=f"Reprice {r['item']}",
                body=r["message"],
                icon="💰",
                severity=SEV_HIGH,
                cta_label="Update price",
                cta_route="/restaurant/predictions",
                estimated_gain=r.get("potential_gain", 0),
            ))
        elif r["type"] == "promotion":
            out.append(_action(
                kind="promotion",
                title=f"Promote {r['item']} tonight",
                body=r["message"],
                icon="📣",
                severity=SEV_MEDIUM,
                cta_label="Create campaign",
                cta_route="/restaurant/marketing",
                estimated_gain=r.get("potential_gain", 0),
            ))
        elif r["type"] == "quality_review":
            out.append(_action(
                kind="quality_review",
                title=f"Review {r['item']} quality",
                body=r["message"],
                icon="⚠️",
                severity=SEV_HIGH,
                cta_label="Open menu",
                cta_route="/restaurant/predictions",
            ))
    return out


def _menu_broadcast_action(db: Session, user: User, today: date) -> dict | None:
    """If the restaurant hasn't published today's menu, nudge them to. If
    they have, surface this week's broadcast attribution as a win."""
    cutoff = today - timedelta(days=6)
    recent = (
        db.query(
            func.coalesce(func.sum(MenuBroadcast.sms_count), 0),
            func.coalesce(func.sum(MenuBroadcast.click_count), 0),
            func.count(MenuBroadcast.id),
        )
        .filter(MenuBroadcast.user_id == user.id, MenuBroadcast.local_date >= cutoff)
        .one()
    )
    sms, clicks, rounds = (int(x or 0) for x in recent)
    bookings_count = (
        db.query(func.count(Booking.id))
        .join(MenuBroadcast, MenuBroadcast.id == Booking.menu_broadcast_id)
        .filter(MenuBroadcast.user_id == user.id, MenuBroadcast.local_date >= cutoff)
        .scalar() or 0
    )
    today_sent = user.menu_sms_last_sent_date == today

    if not (user.menu_of_the_day or "").strip():
        return _action(
            kind="menu_publish",
            title="Publish today's menu",
            body="Your opted-in CRM customers will get it by SMS at 11am local. Empty menu = no broadcast.",
            icon="🍽",
            severity=SEV_MEDIUM,
            cta_label="Publish menu",
            cta_route="/restaurant/bookings",
        )
    if not today_sent and rounds == 0:
        # Has a menu, but never broadcast — opt-in customers must be at zero.
        return _action(
            kind="crm_optin",
            title="Opt customers in for menu SMS",
            body="You published a menu but no CRM customer is opted in. Flip the Menu SMS toggle on your regulars.",
            icon="📱",
            severity=SEV_MEDIUM,
            cta_label="Open CRM",
            cta_route="/restaurant/crm",
        )
    if bookings_count > 0:
        return _action(
            kind="broadcast_wins",
            title=f"Menu SMS drove {bookings_count} booking{'s' if bookings_count != 1 else ''} this week",
            body=f"{sms} messages sent · {clicks} clicks · {bookings_count} bookings attributed in the last 7 days.",
            icon="🎯",
            severity=SEV_LOW,
            cta_label="See attribution",
            cta_route="/restaurant/bookings",
        )
    return None


def _booking_action(db: Session, user_id: int, today: date) -> dict | None:
    """Either celebrate tonight's covers, or nudge to share the booking link
    if the calendar is empty."""
    todays = (
        db.query(Booking)
        .filter(Booking.user_id == user_id, Booking.date == today,
                Booking.status.in_(["confirmed", "seated"]))
        .all()
    )
    if not todays:
        return _action(
            kind="empty_calendar",
            title="Calendar is empty tonight",
            body="Drop your /r/{slug} link into your WhatsApp and Instagram bio — every share is one more cover.",
            icon="📅",
            severity=SEV_MEDIUM,
            cta_label="Share link",
            cta_route="/restaurant/bookings",
        )
    covers = sum(b.party_size for b in todays)
    return _action(
        kind="tonight_covers",
        title=f"{len(todays)} bookings tonight · {covers} covers",
        body="Open the bookings page for the seating plan and prep notes.",
        icon="✅",
        severity=SEV_LOW,
        cta_label="Open bookings",
        cta_route="/restaurant/bookings",
    )


def _waste_action(db: Session, user_id: int) -> dict | None:
    """Surface the single worst waste line item this week as something to fix."""
    try:
        summary = waste_service.get_waste_summary(db, user_id)
    except Exception:
        return None
    if not summary:
        return None
    top = summary.get("top_items") or summary.get("by_item") or []
    cost = summary.get("total_cost", 0) or 0
    if cost < 25 and not top:
        return None
    if top:
        worst = top[0]
        name = worst.get("name") or worst.get("item") or "an ingredient"
        amount = worst.get("cost") or worst.get("total_cost") or 0
        return _action(
            kind="waste_hotspot",
            title=f"Reduce {name} waste",
            body=f"Highest-cost waste item this week (${amount:.0f}). Drop prep by 15% or batch in smaller portions.",
            icon="🗑",
            severity=SEV_MEDIUM,
            cta_label="Open waste log",
            cta_route="/restaurant/waste",
            estimated_gain=amount * 0.5,
        )
    return _action(
        kind="waste_review",
        title=f"Waste this week: ${cost:.0f}",
        body="Review your top-cost items and adjust prep volumes.",
        icon="🗑",
        severity=SEV_LOW,
        cta_label="Open waste log",
        cta_route="/restaurant/waste",
    )


def _workforce_action(db: Session, user_id: int) -> dict | None:
    """Surface the single most urgent workforce signal (attrition first,
    then overtime) as one Action Plan card."""
    try:
        from . import workforce_intelligence_service as wf
        wfdata = wf.build(db, user_id)
    except Exception:
        return None
    risks = wfdata.get("attrition_risks") or []
    if risks:
        top = risks[0]
        return _action(
            kind="attrition_risk",
            title=f"{top['name']} may be at flight risk",
            body=f"{int(top['confidence'] * 100)}% — {', '.join(top['reasons'][:2])}. {top['recommendation']}",
            icon="🧑‍🍳",
            severity=SEV_HIGH,
            cta_label="Review staff",
            cta_route="/restaurant/staff",
        )
    ot = wfdata.get("overtime_alerts") or []
    if ot:
        top = ot[0]
        return _action(
            kind="overtime",
            title=f"{top['name']} is heading into overtime",
            body=f"~{top['estimated_weekly_hours']}h this week. {top['recommendation']}",
            icon="⏱",
            severity=SEV_MEDIUM,
            cta_label="Review staff",
            cta_route="/restaurant/staff",
        )
    return None


def build_action_plan(db: Session, user: User, *, today: date | None = None) -> list[dict]:
    """Compose the day's Action Plan. Returns up to 5 cards, sorted so the
    operator's eye lands on revenue-impacting items first."""
    if today is None:
        today = date.today()

    actions: list[dict] = []
    actions.extend(_star_actions(db, user.id))
    menu = _menu_broadcast_action(db, user, today)
    if menu:
        actions.append(menu)
    booking = _booking_action(db, user.id, today)
    if booking:
        actions.append(booking)
    waste = _waste_action(db, user.id)
    if waste:
        actions.append(waste)
    workforce = _workforce_action(db, user.id)
    if workforce:
        actions.append(workforce)

    # Severity → sort key. high before medium before low; tie-broken by
    # estimated_gain (bigger wins first).
    sev_rank = {SEV_HIGH: 0, SEV_MEDIUM: 1, SEV_LOW: 2}
    actions.sort(key=lambda a: (sev_rank.get(a["severity"], 99), -a["estimated_gain"]))
    return actions[:5]
