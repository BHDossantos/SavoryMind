"""Marketing automation trigger log (AI-OS Module 8).

One row per fired trigger so the daily cron is idempotent (a birthday
fires once a year, a lapsed-guest nudge once a month) and the owner has
an audit trail. The trigger surfaces an owner-facing action — the owner
one-click sends the offer — so we never message a diner without the
restaurant's decision (GDPR-safe).
"""
import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint, JSON

from ..core.database import Base


class MarketingLead(Base):
    """A lead captured from the public waste calculator (/calcolatore-spreco).

    Turns anonymous funnel traffic into a contactable prospect: the estimate
    they saw + the profile they entered, so follow-up is grounded in their own
    number. Public, unauthenticated capture — no account required.
    """
    __tablename__ = "marketing_leads"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    restaurant_name = Column(String(200), nullable=True)
    source = Column(String(40), nullable=False, default="calcolatore")
    profile = Column(JSON, nullable=True)          # {covers_per_day, avg_ticket_eur, ...}
    band_low = Column(Float, nullable=True)         # € monthly loss shown to them
    band_high = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class MarketingTrigger(Base):
    __tablename__ = "marketing_triggers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # owner
    customer_id = Column(Integer, ForeignKey("crm_customers.id"), nullable=False, index=True)
    trigger_type = Column(String(30), nullable=False)   # birthday | lapsed
    period = Column(String(30), nullable=False)         # idempotency key window
    status = Column(String(20), nullable=False, default="suggested")  # suggested|sent|dismissed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("customer_id", "trigger_type", "period", name="uq_marketing_trigger"),
    )
