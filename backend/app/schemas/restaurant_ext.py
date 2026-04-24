from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime


# --- Bookings ---

class BookingCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    date: date
    time_slot: str
    party_size: int
    table_number: Optional[int] = None
    notes: Optional[str] = None


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    table_number: Optional[int] = None
    notes: Optional[str] = None
    time_slot: Optional[str] = None


class BookingResponse(BaseModel):
    id: int
    customer_name: str
    customer_email: Optional[str]
    customer_phone: Optional[str]
    date: date
    time_slot: str
    party_size: int
    table_number: Optional[int]
    status: str
    notes: Optional[str]
    created_at: datetime
    diner_user_id: Optional[int] = None
    source: Optional[str] = "manual"

    model_config = {"from_attributes": True}


# --- CRM ---

class CRMCustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    favorite_items: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class CRMCustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    total_visits: Optional[int] = None
    total_spend: Optional[float] = None
    favorite_items: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class CRMCustomerResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    total_visits: int
    total_spend: float
    last_visit: Optional[date]
    favorite_items: Optional[str]
    notes: Optional[str]
    tags: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Staff ---

class StaffCreate(BaseModel):
    name: str
    role: str
    shift: str
    hire_date: Optional[date] = None
    notes: Optional[str] = None


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    shift: Optional[str] = None
    rating: Optional[float] = None
    orders_handled: Optional[int] = None
    avg_order_value: Optional[float] = None
    punctuality_score: Optional[float] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class StaffResponse(BaseModel):
    id: int
    name: str
    role: str
    shift: str
    hire_date: Optional[date]
    rating: float
    orders_handled: int
    avg_order_value: float
    punctuality_score: float
    notes: Optional[str]
    active: bool

    model_config = {"from_attributes": True}


# --- Predictions ---

class PredictedItem(BaseModel):
    name: str
    category: str
    predicted_orders: int
    predicted_revenue: float
    confidence: float
    trend: str   # "rising" | "stable" | "declining"


class SalesPrediction(BaseModel):
    window_label: str      # "Next 4 hours (12:00 – 16:00)"
    day_label: str         # "Tuesday lunch"
    top_items: list[PredictedItem]
    total_predicted_revenue: float
    recommended_prep: list[str]
    staffing_note: str
