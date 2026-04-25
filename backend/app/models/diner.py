import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Date, Boolean, ForeignKey
from ..core.database import Base


class DinerBooking(Base):
    __tablename__ = "diner_bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    restaurant_name = Column(String(150), nullable=False)
    booking_date = Column(String(20), nullable=False)  # ISO date string
    booking_time = Column(String(10), nullable=False, default="19:00")
    party_size = Column(Integer, nullable=False, default=2)
    special_requests = Column(Text)
    status = Column(String(20), default="confirmed")  # confirmed | pending | cancelled | declined
    created_at = Column(Date, default=datetime.date.today)
    # Set when booking is linked to a registered restaurant on the platform
    restaurant_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    restaurant_booking_id = Column(Integer, nullable=True)  # mirrors Booking.id


class DinerReview(Base):
    __tablename__ = "diner_reviews"
    id                 = Column(Integer, primary_key=True, index=True)
    diner_user_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    restaurant_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id         = Column(Integer, nullable=True)   # which booking prompted the review
    rating             = Column(Float, nullable=False)    # 1–5
    comment            = Column(Text, nullable=True)
    created_at         = Column(Date, default=datetime.date.today)


class DinerVisit(Base):
    __tablename__ = "diner_visits"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    restaurant_name = Column(String(150), nullable=False)
    visit_date = Column(String(20), nullable=False)
    items_ordered = Column(Text)  # comma-separated dish names
    overall_rating = Column(Float, default=5.0)
    food_rating = Column(Float, default=5.0)
    staff_rating = Column(Float, default=5.0)
    would_return = Column(Boolean, default=True)
    highlights = Column(Text)  # what they loved
    lowlights = Column(Text)   # what they didn't like
    notes = Column(Text)
