from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.diner import DinerReview
from ...models.restaurant_ext import Booking, MenuBroadcast
from ...schemas.restaurant_ext import (
    BookingCreate, BookingUpdate, BookingResponse,
    CRMCustomerCreate, CRMCustomerUpdate, CRMCustomerResponse,
    StaffCreate, StaffUpdate, StaffResponse,
    SalesPrediction,
)
from ...services import (
    booking_service, crm_service, staff_service, prediction_service,
    trends_service, action_plan_service, campaign_service, posthog_client,
)
from ...core.config import settings

router = APIRouter(prefix="/restaurant", tags=["restaurant"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


# --- Bookings ---

@router.get("/bookings/today")
def today_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return booking_service.get_today_summary(db, current_user.id)


@router.get("/bookings", response_model=list[BookingResponse])
def list_bookings(
    filter_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return booking_service.get_bookings(db, current_user.id, filter_date)


@router.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return booking_service.create_booking(db, current_user.id, data)


@router.patch("/bookings/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    data: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    b = booking_service.update_booking(db, current_user.id, booking_id, data)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    if not booking_service.delete_booking(db, current_user.id, booking_id):
        raise HTTPException(status_code=404, detail="Booking not found")


@router.patch("/bookings/{booking_id}/confirm", response_model=BookingResponse)
def confirm_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    b = booking_service.confirm_booking(db, current_user.id, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Online booking not found.")
    return b


@router.patch("/bookings/{booking_id}/decline", response_model=BookingResponse)
def decline_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    b = booking_service.decline_booking(db, current_user.id, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Online booking not found.")
    return b


# --- CRM ---

@router.get("/crm/summary")
def crm_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return crm_service.get_crm_summary(db, current_user.id)


@router.get("/crm", response_model=list[CRMCustomerResponse])
def list_customers(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return crm_service.get_customers(db, current_user.id, search)


@router.post("/crm", response_model=CRMCustomerResponse, status_code=201)
def create_customer(
    data: CRMCustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return crm_service.create_customer(db, current_user.id, data)


@router.patch("/crm/{customer_id}", response_model=CRMCustomerResponse)
def update_customer(
    customer_id: int,
    data: CRMCustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    c = crm_service.update_customer(db, current_user.id, customer_id, data)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.post("/crm/{customer_id}/visit", response_model=CRMCustomerResponse)
def record_visit(
    customer_id: int,
    spend: float = 0.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    c = crm_service.record_visit(db, current_user.id, customer_id, spend)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.delete("/crm/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    if not crm_service.delete_customer(db, current_user.id, customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")


# --- Staff ---

@router.get("/staff/summary")
def staff_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return staff_service.get_performance_summary(db, current_user.id)


@router.get("/staff", response_model=list[StaffResponse])
def list_staff(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return staff_service.get_staff(db, current_user.id)


@router.post("/staff", response_model=StaffResponse, status_code=201)
def create_staff(
    data: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return staff_service.create_staff(db, current_user.id, data)


@router.patch("/staff/{staff_id}", response_model=StaffResponse)
def update_staff(
    staff_id: int,
    data: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    s = staff_service.update_staff(db, current_user.id, staff_id, data)
    if not s:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return s


@router.delete("/staff/{staff_id}", status_code=204)
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    if not staff_service.delete_staff(db, current_user.id, staff_id):
        raise HTTPException(status_code=404, detail="Staff member not found")


# --- Sales Predictions ---

@router.get("/predictions", response_model=SalesPrediction)
def get_predictions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return prediction_service.predict_sales(db, current_user.id)


# --- Trends & Marketing -------------------------------------------------------

@router.get("/trends")
def get_trends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return trends_service.get_menu_trends(db, current_user.id)


@router.get("/marketing")
def get_marketing(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return trends_service.get_marketing_insights(db, current_user.id)


class CampaignRequest(BaseModel):
    dish: str
    angle: str = "promotion"
    notes: str = ""


@router.post("/campaigns/generate")
def generate_campaign(
    body: CampaignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One-click campaign: Claude returns Instagram caption + WhatsApp +
    email + SMS bodies ready to paste. The operator approves what they
    want, the rest is throwaway. Falls back to a localized template when
    Claude isn't configured so the UX never dead-ends."""
    _require_restaurant(current_user)
    booking_link = None
    if current_user.slug:
        booking_link = f"{settings.frontend_url.rstrip('/')}/r/{current_user.slug}"
    out = campaign_service.generate(
        dish=body.dish,
        angle=body.angle,
        restaurant_name=current_user.restaurant_name or current_user.display_name or "the restaurant",
        cuisine=current_user.restaurant_cuisine or "",
        language=current_user.language or "en",
        booking_link=booking_link,
        notes=body.notes,
    )
    posthog_client.capture(current_user.id, "campaign_generated", {
        "angle": body.angle,
        "language": current_user.language or "en",
    })
    return out


# --- Diner Reviews (submitted by diners about this restaurant) ----------------

@router.get("/diner-reviews")
def get_diner_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    rows = (
        db.query(DinerReview, User)
        .join(User, User.id == DinerReview.diner_user_id)
        .filter(DinerReview.restaurant_user_id == current_user.id)
        .order_by(DinerReview.created_at.desc())
        .all()
    )
    avg = round(sum(r.rating for r, _ in rows) / len(rows), 1) if rows else None
    return {
        "avg_rating": avg,
        "total": len(rows),
        "reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": str(r.created_at),
                "diner_name": u.display_name or u.email,
            }
            for r, u in rows
        ],
    }



# --- Menu broadcast attribution ---

@router.get("/menu-broadcasts/stats")
def menu_broadcast_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rolling 7-day rollup of the daily menu SMS broadcast: how many
    customers were messaged, how many tapped the link, and how many
    bookings were attributed back. The number the operator looks at
    before deciding whether €99/mo is worth it."""
    _require_restaurant(current_user)
    cutoff = date.today() - timedelta(days=6)  # inclusive 7-day window

    totals = (
        db.query(
            func.coalesce(func.sum(MenuBroadcast.sms_count), 0).label("sms"),
            func.coalesce(func.sum(MenuBroadcast.click_count), 0).label("clicks"),
            func.count(MenuBroadcast.id).label("rounds"),
        )
        .filter(
            MenuBroadcast.user_id == current_user.id,
            MenuBroadcast.local_date >= cutoff,
        )
        .one()
    )

    bookings_count = (
        db.query(func.count(Booking.id))
        .join(MenuBroadcast, MenuBroadcast.id == Booking.menu_broadcast_id)
        .filter(
            MenuBroadcast.user_id == current_user.id,
            MenuBroadcast.local_date >= cutoff,
        )
        .scalar()
        or 0
    )

    return {
        "window_days":  7,
        "rounds":       int(totals.rounds or 0),
        "sms_sent":     int(totals.sms or 0),
        "clicks":       int(totals.clicks or 0),
        "bookings":     int(bookings_count),
    }


# --- Today's AI Action Plan ---

@router.get("/action-plan")
def action_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the short list of "do these today" cards rolled up from
    menu recommendations, the booking calendar, food waste, and menu
    broadcast attribution. The dashboard renders these as the operator's
    first surface."""
    _require_restaurant(current_user)
    actions = action_plan_service.build_action_plan(db, current_user)
    posthog_client.capture(current_user.id, "action_plan_viewed", {"action_count": len(actions)})
    return {"actions": actions}


# --- Audit log + Entitlements ---

@router.get("/audit-log")
def audit_log(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Audit trail for the tenant. Owner/manager only — others get 403."""
    _require_restaurant(current_user)
    from ...core import roles as roles_mod
    from ...services import audit_log_service
    if not roles_mod.can(current_user, "audit_log.view"):
        raise HTTPException(status_code=403, detail="Owner or manager only.")
    return [
        {
            "id": r.id,
            "actor_user_id": r.actor_user_id,
            "action": r.action,
            "target": r.target,
            "metadata": r.extra_metadata,
            "created_at": r.created_at.isoformat(),
        }
        for r in audit_log_service.list_for_tenant(db, current_user.id)
    ]


@router.get("/menu/matrix")
def menu_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Menu engineering matrix: every item tagged star/plowhorse/puzzle/dog
    based on margin × popularity. Backs the /restaurant/predictions widget."""
    _require_restaurant(current_user)
    from ...services import menu_matrix_service
    return menu_matrix_service.build_matrix(db, current_user.id)


# --- Guest Intelligence (AI CRM) ---

@router.get("/crm/segments")
def crm_segments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Counts per auto-segment (vip / new / inactive / high_spender /
    birthday_this_month / wine_lover / dietary / ...). Drives the CRM
    segment chips."""
    _require_restaurant(current_user)
    from ...services import guest_intelligence_service as gi
    return gi.segment_summary(db, current_user.id)


@router.get("/crm/at-risk")
def crm_at_risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lapsed-but-valuable guests ranked by value-at-stake × recoverability,
    each with a return-probability estimate. The win-back action list."""
    _require_restaurant(current_user)
    from ...services import guest_intelligence_service as gi
    return {"guests": gi.at_risk_guests(db, current_user.id)}


@router.get("/crm/{customer_id}/timeline")
def crm_timeline(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unified interaction timeline for one guest."""
    _require_restaurant(current_user)
    from ...services import guest_intelligence_service as gi
    return {"events": gi.timeline_for(db, current_user.id, customer_id)}


class WinBackRequest(BaseModel):
    offer: str = ""          # e.g. "15% off a steak dinner" — operator-set or AI-suggested
    send: bool = False       # False = draft only; True = draft AND send via SMS


@router.post("/crm/{customer_id}/winback")
def crm_winback(
    customer_id: int,
    body: WinBackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Draft (and optionally send) a personalized win-back SMS for a lapsed
    guest. Draft uses the campaign generator's voice; send goes through the
    same Twilio path as the menu broadcast. Nothing sends unless send=True."""
    _require_restaurant(current_user)
    from ...models.restaurant_ext import CRMCustomer
    from ...services import campaign_service, guest_intelligence_service as gi, twilio_client

    c = db.query(CRMCustomer).filter(
        CRMCustomer.id == customer_id, CRMCustomer.user_id == current_user.id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    dsl = gi._days_since(c.last_visit, date.today())
    fave = c.favorite_dishes or c.favorite_items or ""
    offer = body.offer.strip() or (f"a treat on {fave.split(',')[0].strip()}" if fave else "a little something on us")
    booking_link = None
    if current_user.slug:
        booking_link = f"{settings.frontend_url.rstrip('/')}/r/{current_user.slug}"

    campaign = campaign_service.generate(
        dish=fave.split(",")[0].strip() or "your favourite",
        angle="comeback",
        restaurant_name=current_user.restaurant_name or current_user.display_name or "the restaurant",
        cuisine=current_user.restaurant_cuisine or "",
        language=current_user.language or "en",
        booking_link=booking_link,
        notes=f"Win-back for {c.name}; last visit {dsl} days ago; offer: {offer}",
    )
    sms_body = campaign.get("sms_body") or campaign.get("whatsapp_message") or ""

    sent = False
    if body.send and c.phone:
        sent = twilio_client.send_sms(c.phone, sms_body)
        posthog_client.capture(current_user.id, "winback_sent", {
            "days_since_visit": dsl, "had_offer": bool(body.offer.strip()),
        })

    return {
        "customer_id": customer_id,
        "sms_body": sms_body,
        "instagram_caption": campaign.get("instagram_caption", ""),
        "email_subject": campaign.get("email_subject", ""),
        "email_body": campaign.get("email_body", ""),
        "return_probability": gi.return_probability(c),
        "sent": sent,
    }


# --- Workforce Intelligence (AI staff layer, Restaurant OS Wave B) ---

@router.get("/staff/intelligence")
def staff_intelligence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Overtime alerts, attrition risk, and demand-based staffing for the
    next window — the AI Workforce panel. Heuristic, computed on read."""
    _require_restaurant(current_user)
    from ...services import workforce_intelligence_service as wf
    return wf.build(db, current_user.id)
