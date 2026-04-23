import datetime
from sqlalchemy import Column, Integer, String, Float, Text, Date, DateTime, ForeignKey
from ..core.database import Base


class FoodWasteLog(Base):
    __tablename__ = "food_waste_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    staff_name = Column(String(100), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    estimated_cost = Column(Float, nullable=False)
    reason = Column(String(200))
    date = Column(Date, default=datetime.date.today)
    notes = Column(Text)


class DishTimeLog(Base):
    __tablename__ = "dish_time_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    staff_name = Column(String(100), nullable=False)
    prep_minutes = Column(Float, nullable=False)
    cook_minutes = Column(Float, nullable=False)
    date = Column(Date, default=datetime.date.today)
    notes = Column(Text)


class StaffTimeLog(Base):
    __tablename__ = "staff_time_logs"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, nullable=False, index=True)
    staff_name    = Column(String(100), nullable=False)
    date          = Column(String(20), nullable=False)   # YYYY-MM-DD
    clock_in      = Column(String(10), nullable=False)   # HH:MM
    clock_out     = Column(String(10), nullable=False)   # HH:MM
    break_minutes = Column(Integer, default=0)
    total_hours   = Column(Float, nullable=False)        # computed on save
    notes         = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)
