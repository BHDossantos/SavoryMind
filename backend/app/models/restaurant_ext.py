from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Date, ForeignKey
from datetime import datetime
from ..core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    date = Column(Date, nullable=False)
    time_slot = Column(String, nullable=False)   # "19:00"
    party_size = Column(Integer, nullable=False)
    table_number = Column(Integer, nullable=True)
    status = Column(String, default="confirmed")  # confirmed | pending | seated | completed | cancelled | declined
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Online booking fields — set when a diner books through the platform
    diner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    source = Column(String, default="manual")  # manual | online | public
    # Idempotency flag for the day-before reminder scheduler — non-null
    # means the reminder has been delivered (or attempted), do not re-send.
    reminder_sent_at = Column(DateTime, nullable=True)
    # Attribution back to the daily menu broadcast that drove this booking,
    # if any. Stamped by the public booking endpoint from a short-lived
    # cookie set when the diner taps a /r/{slug}?b={id} link in the SMS.
    menu_broadcast_id = Column(Integer, ForeignKey("menu_broadcasts.id"), nullable=True)
    # Manager-private notes about the guest — "allergic to shellfish",
    # "VIP, comp dessert", "celebrating anniversary". Separate from `notes`
    # (the guest's own special requests). Surfaced via repeat detection.
    customer_notes = Column(Text, nullable=True)


class SavedRestaurant(Base):
    """Consumer favorites. (user_id, restaurant_id) is unique. Surface on
    the consumer dashboard and unlock geofence-style nudges later."""
    __tablename__ = "saved_restaurants"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)


class MenuBroadcast(Base):
    """One row per restaurant per daily menu-of-the-day SMS round.

    Created when the cron dispatches the round; click_count increments on
    /r/{slug}?b={id} hits. Bookings carry menu_broadcast_id when the diner
    converts within the attribution window. The restaurant dashboard rolls
    this up into "X SMSs, Y clicks, Z bookings — €99/mo earned."
    """
    __tablename__ = "menu_broadcasts"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sent_at       = Column(DateTime, nullable=False, default=datetime.utcnow)
    local_date    = Column(Date, nullable=False)   # restaurant-local calendar day
    sms_count     = Column(Integer, nullable=False, default=0)
    click_count   = Column(Integer, nullable=False, default=0)
    menu_snapshot = Column(Text, nullable=True)    # what was sent, for the dashboard


class CRMCustomer(Base):
    __tablename__ = "crm_customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    total_visits = Column(Integer, default=0)
    total_spend = Column(Float, default=0.0)
    last_visit = Column(Date, nullable=True)
    favorite_items = Column(Text, nullable=True)   # comma-separated
    notes = Column(Text, nullable=True)
    tags = Column(String, nullable=True)            # "vip,regular,birthday"
    # Opt-in flag for the daily menu-of-the-day SMS broadcast. Default
    # False = the cron never SMSs a customer who didn't explicitly say yes.
    menu_sms_opt_in = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Rich guest profile — the CRM fields restaurants actually use. All
    # nullable so existing rows are untouched. Powers guest intelligence
    # (birthday campaigns, dietary-aware offers, segment membership).
    birthday        = Column(Date, nullable=True)
    anniversary     = Column(Date, nullable=True)
    allergies       = Column(Text, nullable=True)     # free text or comma list
    favorite_dishes = Column(Text, nullable=True)     # comma-separated
    favorite_drinks = Column(Text, nullable=True)     # comma-separated
    wine_pref       = Column(String, nullable=True)   # "Cabernet", "Pinot Noir"
    seating_pref    = Column(String, nullable=True)   # "Corner booth", "Patio"
    address         = Column(Text, nullable=True)
    # Loyalty — points accrue on visits; tier is derived but cached here so
    # the CRM list can render it without recomputing per row.
    loyalty_points  = Column(Integer, nullable=False, default=0, server_default="0")
    loyalty_tier    = Column(String, nullable=True)   # bronze | silver | gold | vip


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)          # chef | server | bartender | host | manager
    shift = Column(String, nullable=False)         # morning | afternoon | evening | full
    hire_date = Column(Date, nullable=True)
    rating = Column(Float, default=4.0)
    orders_handled = Column(Integer, default=0)
    avg_order_value = Column(Float, default=0.0)
    punctuality_score = Column(Float, default=100.0)  # 0-100
    notes = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    # Coaching engine v2 (P2). All nullable — existing staff rows keep working.
    hourly_cost = Column(Float, nullable=True)          # € labour cost/hr
    whatsapp_number = Column(String(32), nullable=True) # E.164, only after consent
    whatsapp_consent_at = Column(DateTime, nullable=True)  # GDPR consent timestamp
    language = Column(String(10), nullable=True)        # plan language, e.g. "it"


class Incident(Base):
    """A single quantified loss event attributed to a staff member — the
    structured, explicit source of coaching signal (vs. the implicit
    FoodWasteLog/DishTimeLog). Every euro in a coaching plan traces back
    to rows here (notes §6.1)."""
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # owner/tenant
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False)   # waste|portioning|speed|punctuality|quality
    occurred_at = Column(Date, nullable=False, default=datetime.utcnow)
    quantity = Column(Float, nullable=True)      # e.g. kg, minutes
    unit = Column(String(20), nullable=True)     # "kg" | "min" | ...
    euro_impact = Column(Float, nullable=False, default=0.0)
    cause_tags = Column(Text, nullable=True)     # JSON array of tag strings
    source = Column(String(20), nullable=False, default="manual")  # manual|import|inferred
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CoachingPlan(Base):
    """A dignity-preserving, owner-approved coaching plan for one staff
    member over a period. Draft until the owner approves; approved plans
    are delivered (WhatsApp/in-app). Every € figure references incidents."""
    __tablename__ = "coaching_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    period = Column(String(20), nullable=False)   # e.g. "2026-W27"
    priority = Column(String(10), nullable=False, default="medium")  # high|medium|low
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False)
    euro_impact_total = Column(Float, nullable=False, default=0.0)
    expected_recovery = Column(Float, nullable=True)
    actions_json = Column(Text, nullable=False, default="[]")  # [{text, done, due_hint}]
    language = Column(String(10), nullable=False, default="it")
    status = Column(String(10), nullable=False, default="draft")  # draft|active|completed
    generated_by_model = Column(Boolean, nullable=False, default=False)
    reviewed_by_owner = Column(Boolean, nullable=False, default=False)
    delivered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalesLog(Base):
    __tablename__ = "sales_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_name = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    revenue = Column(Float, default=0.0)
    sale_date = Column(Date, nullable=False)
    hour_of_day = Column(Integer, nullable=False)   # 0-23
    day_of_week = Column(Integer, nullable=False)   # 0=Mon, 6=Sun


class LoyaltyReward(Base):
    """A reward a restaurant offers for loyalty points (e.g. 'Free dessert'
    for 500 pts). Scoped per restaurant via user_id."""
    __tablename__ = "loyalty_rewards"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name        = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    points_cost = Column(Integer, nullable=False)
    active      = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)


class LoyaltyRedemption(Base):
    """Log of a customer redeeming a reward. Points are deducted from the
    CRMCustomer at redemption time; reward_name is snapshotted so history
    survives reward edits/deletes."""
    __tablename__ = "loyalty_redemptions"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    customer_id  = Column(Integer, ForeignKey("crm_customers.id"), nullable=False, index=True)
    reward_id    = Column(Integer, ForeignKey("loyalty_rewards.id"), nullable=True)
    reward_name  = Column(String(120), nullable=False)
    points_spent = Column(Integer, nullable=False)
    redeemed_at  = Column(DateTime, default=datetime.utcnow, nullable=False)


class Shift(Base):
    """A planned shift for a staff member. Backs the weekly schedule grid."""
    __tablename__ = "shifts"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    staff_id   = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    date       = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False)   # "09:00"
    end_time   = Column(String(5), nullable=False)   # "17:00"
    role       = Column(String(40), nullable=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class TimePunch(Base):
    """A clock-in/out event. clock_out null = currently on the clock.
    Paired into worked hours by scheduling_service."""
    __tablename__ = "time_punches"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    staff_id      = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    clock_in      = Column(DateTime, nullable=False, default=datetime.utcnow)
    clock_out     = Column(DateTime, nullable=True)
    break_minutes = Column(Integer, nullable=False, default=0, server_default="0")


class OpsTask(Base):
    """An operational task — one-off or instantiated from a checklist.
    Backs the Operations page's today-view + overdue Action Plan card."""
    __tablename__ = "ops_tasks"

    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title              = Column(String(200), nullable=False)
    category           = Column(String(40), nullable=False, default="general", server_default="general")
    assignee           = Column(String(120), nullable=True)
    due_date           = Column(Date, nullable=True, index=True)
    done               = Column(Boolean, nullable=False, default=False, server_default="0")
    done_at            = Column(DateTime, nullable=True)
    source_template_id = Column(Integer, nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChecklistTemplate(Base):
    """A reusable checklist (Opening / Closing / Compliance) the operator
    instantiates into ops_tasks for a day."""
    __tablename__ = "checklist_templates"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name       = Column(String(120), nullable=False)
    category   = Column(String(40), nullable=False, default="general", server_default="general")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id          = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("checklist_templates.id"), nullable=False, index=True)
    label       = Column(String(200), nullable=False)
    position    = Column(Integer, nullable=False, default=0, server_default="0")
