from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float

from app.core.db import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)

    contact_name = Column(String, nullable=False)
    contact_phone = Column(String, nullable=False)
    contact_email = Column(String, nullable=False)

    date = Column(String, nullable=False)  # YYYY-MM-DD
    time = Column(String, nullable=False)  # HH:MM
    group_size = Column(Integer, default=2, nullable=False)
    request_type = Column(String, nullable=False)
    # dinner|bar_table|guestlist|vip_table|special

    budget_eur = Column(Integer, nullable=True)
    bottle_preference = Column(String, nullable=True)
    arrival_time = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    vip_interest = Column(String, default="no", nullable=False)  # yes|no

    status = Column(String, default="new", nullable=False, index=True)
    # new|pending|confirmed|rejected|cancelled|completed|no_show

    commission_eur = Column(Float, default=0.0, nullable=False)
    venue_response = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)

    reminder_sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
