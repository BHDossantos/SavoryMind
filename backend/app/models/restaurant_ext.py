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
    source = Column(String, default="manual")  # manual | online


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
    created_at = Column(DateTime, default=datetime.utcnow)


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
