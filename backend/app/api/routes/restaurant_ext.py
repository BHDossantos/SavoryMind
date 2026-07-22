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


@router.get("/health-score")
def health_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restaurant Health Score (AI-OS M2): overall 0-100 + Financial/
    Operations/Customer/Staff/Marketing sub-scores with explainable
    drivers. Honest: unmeasured dimensions are excluded, not padded."""
    _require_restaurant(current_user)
    from ...services import health_score_service
    result = health_score_service.health_score(db, current_user.id)
    posthog_client.capture(current_user.id, "health_score_viewed",
                           {"overall": result["overall"], "band": result["band"]})
    return result


@router.get("/command-center")
def command_center(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI Command Center (AI-OS M1): the 'Buongiorno' single-glance hero —
    yesterday revenue/profit, rating, today's reservations, busy hours,
    predicted revenue, inventory/staff alerts, and recommendation count."""
    _require_restaurant(current_user)
    from ...services import command_center_service
    return command_center_service.build(db, current_user)


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


# --- Loyalty rewards + redemption (Restaurant OS Wave C) ---

class LoyaltyRewardCreate(BaseModel):
    name: str
    points_cost: int
    description: str = ""


class LoyaltyRewardUpdate(BaseModel):
    name: Optional[str] = None
    points_cost: Optional[int] = None
    description: Optional[str] = None
    active: Optional[bool] = None


@router.get("/loyalty/rewards")
def list_loyalty_rewards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    rows = loyalty_service.list_rewards(db, current_user.id)
    return [
        {"id": r.id, "name": r.name, "description": r.description,
         "points_cost": r.points_cost, "active": r.active}
        for r in rows
    ]


@router.post("/loyalty/rewards", status_code=201)
def create_loyalty_reward(
    body: LoyaltyRewardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    try:
        r = loyalty_service.create_reward(
            db, current_user.id, name=body.name,
            points_cost=body.points_cost, description=body.description,
        )
    except loyalty_service.LoyaltyError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    return {"id": r.id, "name": r.name, "description": r.description,
            "points_cost": r.points_cost, "active": r.active}


@router.patch("/loyalty/rewards/{reward_id}")
def update_loyalty_reward(
    reward_id: int,
    body: LoyaltyRewardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    r = loyalty_service.update_reward(db, current_user.id, reward_id, **body.model_dump(exclude_none=True))
    if not r:
        raise HTTPException(status_code=404, detail="Reward not found")
    return {"id": r.id, "name": r.name, "description": r.description,
            "points_cost": r.points_cost, "active": r.active}


@router.delete("/loyalty/rewards/{reward_id}", status_code=204)
def delete_loyalty_reward(
    reward_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    if not loyalty_service.delete_reward(db, current_user.id, reward_id):
        raise HTTPException(status_code=404, detail="Reward not found")


@router.get("/loyalty/customers/{customer_id}/available")
def customer_available_rewards(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    try:
        return loyalty_service.affordable_for_customer(db, current_user.id, customer_id)
    except loyalty_service.LoyaltyError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


class RedeemRequest(BaseModel):
    reward_id: int


@router.post("/loyalty/customers/{customer_id}/redeem")
def redeem_reward(
    customer_id: int,
    body: RedeemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    try:
        result = loyalty_service.redeem(db, current_user.id, customer_id, body.reward_id)
    except loyalty_service.LoyaltyError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    posthog_client.capture(current_user.id, "loyalty_redeemed", {
        "points_spent": result["points_spent"],
    })
    return result


@router.get("/loyalty/customers/{customer_id}/history")
def customer_redemption_history(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import loyalty_service
    return {"redemptions": loyalty_service.redemption_history(db, current_user.id, customer_id)}


# --- Scheduling + Time Clock (Restaurant OS Wave D) ---

class ShiftCreate(BaseModel):
    staff_id: int
    date: date
    start_time: str
    end_time: str
    role: str = ""
    notes: str = ""


class ShiftUpdate(BaseModel):
    date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None


@router.get("/schedule")
def get_schedule(
    week_start: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Weekly shift grid. Defaults to the current week (Monday start)."""
    _require_restaurant(current_user)
    from ...services import scheduling_service
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    return scheduling_service.week_schedule(db, current_user.id, week_start)


@router.post("/schedule/shifts", status_code=201)
def create_shift(
    body: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import scheduling_service
    try:
        s = scheduling_service.create_shift(
            db, current_user.id, staff_id=body.staff_id, on_date=body.date,
            start_time=body.start_time, end_time=body.end_time,
            role=body.role, notes=body.notes,
        )
    except scheduling_service.SchedulingError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    return {"id": s.id, "staff_id": s.staff_id, "date": str(s.date),
            "start_time": s.start_time, "end_time": s.end_time, "role": s.role}


@router.patch("/schedule/shifts/{shift_id}")
def update_shift(
    shift_id: int,
    body: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import scheduling_service
    s = scheduling_service.update_shift(db, current_user.id, shift_id, **body.model_dump(exclude_none=True))
    if not s:
        raise HTTPException(status_code=404, detail="Shift not found")
    return {"id": s.id, "staff_id": s.staff_id, "date": str(s.date),
            "start_time": s.start_time, "end_time": s.end_time, "role": s.role}


@router.delete("/schedule/shifts/{shift_id}", status_code=204)
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import scheduling_service
    if not scheduling_service.delete_shift(db, current_user.id, shift_id):
        raise HTTPException(status_code=404, detail="Shift not found")


@router.get("/clock/status")
def clock_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Who's currently on the clock."""
    _require_restaurant(current_user)
    from ...services import scheduling_service
    return {"on_clock": scheduling_service.clock_status(db, current_user.id)}


class ClockRequest(BaseModel):
    staff_id: int
    break_minutes: int = 0


@router.post("/clock/in")
def clock_in(
    body: ClockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import scheduling_service
    try:
        p = scheduling_service.clock_in(db, current_user.id, body.staff_id)
    except scheduling_service.SchedulingError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    return {"punch_id": p.id, "staff_id": p.staff_id, "clock_in": p.clock_in.isoformat()}


@router.post("/clock/out")
def clock_out(
    body: ClockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import scheduling_service
    try:
        p = scheduling_service.clock_out(db, current_user.id, body.staff_id, break_minutes=body.break_minutes)
    except scheduling_service.SchedulingError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    worked = (p.clock_out - p.clock_in).total_seconds() / 3600.0 - (p.break_minutes or 0) / 60.0
    return {"punch_id": p.id, "staff_id": p.staff_id,
            "clock_out": p.clock_out.isoformat(), "hours_worked": round(max(0.0, worked), 2)}


# --- Operations: tasks + checklists (Restaurant OS Wave E) ---

class OpsTaskCreate(BaseModel):
    title: str
    category: str = "general"
    assignee: str = ""
    due_date: Optional[date] = None


class ChecklistCreate(BaseModel):
    name: str
    category: str = "general"
    items: list[str] = []


@router.get("/operations/tasks")
def ops_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Today's operational tasks (open + done) with overdue count."""
    _require_restaurant(current_user)
    from ...services import operations_service
    return operations_service.today_tasks(db, current_user.id)


@router.post("/operations/tasks", status_code=201)
def ops_create_task(
    body: OpsTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import operations_service
    try:
        t = operations_service.create_task(
            db, current_user.id, title=body.title, category=body.category,
            assignee=body.assignee, due_date=body.due_date,
        )
    except operations_service.OperationsError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    return operations_service._task_dict(t)


@router.patch("/operations/tasks/{task_id}")
def ops_toggle_task(
    task_id: int,
    done: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import operations_service
    t = operations_service.set_done(db, current_user.id, task_id, done)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return operations_service._task_dict(t)


@router.delete("/operations/tasks/{task_id}", status_code=204)
def ops_delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import operations_service
    if not operations_service.delete_task(db, current_user.id, task_id):
        raise HTTPException(status_code=404, detail="Task not found")


@router.get("/operations/checklists")
def ops_list_checklists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import operations_service
    return operations_service.list_templates(db, current_user.id)


@router.post("/operations/checklists", status_code=201)
def ops_create_checklist(
    body: ChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import operations_service
    try:
        return operations_service.create_template(
            db, current_user.id, name=body.name, category=body.category, items=body.items,
        )
    except operations_service.OperationsError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@router.delete("/operations/checklists/{template_id}", status_code=204)
def ops_delete_checklist(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import operations_service
    if not operations_service.delete_template(db, current_user.id, template_id):
        raise HTTPException(status_code=404, detail="Checklist not found")


@router.post("/operations/checklists/{template_id}/instantiate")
def ops_instantiate_checklist(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create today's tasks from a checklist template in one tap."""
    _require_restaurant(current_user)
    from ...services import operations_service
    try:
        return operations_service.instantiate(db, current_user.id, template_id)
    except operations_service.OperationsError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


# --- POS integration: Square (real system-of-record data) ---

@router.get("/pos/status")
def pos_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import square_pos_service
    return square_pos_service.status(db, current_user.id)


@router.get("/pos/square/start")
def pos_square_start(current_user: User = Depends(get_current_user)):
    """Returns the Square authorize URL for the SPA to navigate to."""
    _require_restaurant(current_user)
    from ...services import square_pos_service
    if not square_pos_service.is_configured():
        raise HTTPException(status_code=503, detail="Square is not configured on this server.")
    return {"authorize_url": square_pos_service.build_authorize_url(current_user.id)}


@router.get("/pos/square/callback")
def pos_square_callback(
    code: str = "",
    state: str = "",
    db: Session = Depends(get_db),
):
    """Square redirects here after the merchant approves. Identity comes
    from the signed state (no auth header on a browser redirect)."""
    from fastapi.responses import RedirectResponse
    from ...services import square_pos_service
    dest = f"{settings.frontend_url.rstrip('/')}/restaurant/integrations"
    if not code or not state:
        return RedirectResponse(url=f"{dest}?pos=error")
    try:
        user_id = square_pos_service.verify_state(state)
        token_response = square_pos_service.exchange_code(code)
        square_pos_service.save_connection(db, user_id, token_response)
    except Exception:
        return RedirectResponse(url=f"{dest}?pos=error")
    return RedirectResponse(url=f"{dest}?pos=connected")


@router.post("/pos/sync")
def pos_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pull the merchant's catalog + last-30-day orders into SavoryMind."""
    _require_restaurant(current_user)
    from ...services import square_pos_service
    try:
        stats = square_pos_service.sync(db, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    posthog_client.capture(current_user.id, "pos_synced", {"orders": stats.get("orders", 0)})
    return stats


@router.post("/pos/disconnect", status_code=204)
def pos_disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    from ...services import square_pos_service
    square_pos_service.disconnect(db, current_user.id)


# --- ML: what's trending (velocity from POS-fed sales) ---

@router.get("/trending")
def whats_trending(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Menu items ranked by sales momentum (rising/falling) over the last
    two weeks. Sharpens as POS data flows in."""
    _require_restaurant(current_user)
    from ...services import menu_trending_service
    return menu_trending_service.trending(db, current_user.id)
