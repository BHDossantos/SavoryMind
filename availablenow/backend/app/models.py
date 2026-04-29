from datetime import datetime, time
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class Role(str, Enum):
    customer = "customer"
    provider = "provider"
    admin = "admin"


class AppointmentStatus(str, Enum):
    confirmed = "confirmed"
    cancelled_by_customer = "cancelled_by_customer"
    cancelled_by_provider = "cancelled_by_provider"
    completed = "completed"
    no_show = "no_show"


class PaymentStatus(str, Enum):
    not_required = "not_required"
    pending = "pending"
    paid = "paid"
    refunded = "refunded"
    failed = "failed"


class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    suspended = "suspended"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    first_name: str
    last_name: str = ""
    phone: str = ""
    role: Role = Field(default=Role.customer)
    preferred_language: str = "en"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Provider(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    display_name: str
    bio: str = ""
    profile_photo_url: str = ""
    category: str = "barber"  # barber, hair_salon, nails, massage, lashes, brows, makeup
    address: str = ""
    city: str = "Rome"
    neighborhood: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    languages: str = "it,en"  # csv
    is_verified: bool = False
    approval_status: ApprovalStatus = Field(default=ApprovalStatus.pending)
    suspended_reason: str = ""
    average_rating: float = 0.0
    review_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Service(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="provider.id", index=True)
    name: str
    description: str = ""
    duration_minutes: int
    price_cents: int
    currency: str = "EUR"
    active: bool = True
    deposit_required: bool = False
    deposit_amount_cents: int = 0


class Availability(SQLModel, table=True):
    """Recurring weekly availability window."""
    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="provider.id", index=True)
    day_of_week: int  # 0 = Monday ... 6 = Sunday
    start_time: time
    end_time: time


class BlockedTime(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="provider.id", index=True)
    start_at: datetime
    end_at: datetime
    reason: str = ""


class Appointment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="user.id", index=True)
    provider_id: int = Field(foreign_key="provider.id", index=True)
    service_id: int = Field(foreign_key="service.id")
    start_at: datetime = Field(index=True)
    end_at: datetime
    status: AppointmentStatus = Field(default=AppointmentStatus.confirmed)
    total_price_cents: int
    deposit_amount_cents: int = 0
    payment_status: PaymentStatus = Field(default=PaymentStatus.not_required)
    customer_notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointment.id", index=True)
    customer_id: int = Field(foreign_key="user.id", index=True)
    provider_id: int = Field(foreign_key="provider.id", index=True)
    amount_cents: int
    currency: str = "EUR"
    status: PaymentStatus = Field(default=PaymentStatus.pending)
    provider_kind: str = "stripe"  # "stripe" or "stub"
    provider_session_id: str = ""  # stripe checkout session id
    provider_payment_id: str = ""  # stripe payment intent id once known
    refunded_amount_cents: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Review(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointment.id", unique=True)
    customer_id: int = Field(foreign_key="user.id", index=True)
    provider_id: int = Field(foreign_key="provider.id", index=True)
    rating: int  # 1..5
    comment: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
