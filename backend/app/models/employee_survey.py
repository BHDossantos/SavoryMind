"""Employee QR-survey responses.

A diner scans an employee's printed QR code → the mobile app fetches the
survey definition (fixed global set) → submits answers. Each submission
is anonymous (no account required); we identify the device via a UUID
the mobile app stores in expo-secure-store, which lets the restaurant
see "how many unique scanners" vs "how many total submissions".

Foreign keys both point at users.id:
  - employee_user_id   → the staff row (account_type='staff')
  - restaurant_user_id → that staff's employer (account_type='restaurant')

Storing both is a tiny denormalisation, but it makes restaurant-scoped
queries one join cheaper and keeps responses attributed correctly even
if an employee later moves restaurants.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index

from ..core.database import Base


class EmployeeSurveyResponse(Base):
    __tablename__ = "employee_survey_responses"

    id                  = Column(Integer, primary_key=True, index=True)
    employee_user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    restaurant_user_id  = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    device_id           = Column(String(64), nullable=False, index=True)
    # Snapshot of the survey question set in effect at submission time, plus
    # the diner's answers. Stored as JSON text rather than a column-per-question
    # so iterating on the survey doesn't require a migration.
    # Shape: {"answers": {"q1": 5, "q2": "...", ...}, "survey_version": 1}
    responses           = Column(Text, nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)


# Restaurant-side aggregation queries always filter on
# (restaurant_user_id, created_at) — a composite index covers the common
# "show me last N days for this restaurant" pattern.
Index(
    "ix_employee_survey_restaurant_created",
    EmployeeSurveyResponse.restaurant_user_id,
    EmployeeSurveyResponse.created_at,
)
