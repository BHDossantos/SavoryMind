from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, EmailStr

from .models import AppointmentStatus, PaymentStatus, Role


class SignupIn(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str = ""
    phone: str = ""
    role: Role = Role.customer


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    first_name: str
    last_name: str
    role: Role


class ProviderIn(BaseModel):
    display_name: str
    bio: str = ""
    profile_photo_url: str = ""
    category: str = "barber"
    address: str = ""
    city: str = "Rome"
    neighborhood: str = ""
    languages: str = "it,en"


class ProviderOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    bio: str
    profile_photo_url: str
    category: str
    address: str
    city: str
    neighborhood: str
    languages: str
    is_verified: bool
    average_rating: float
    review_count: int


class ServiceIn(BaseModel):
    name: str
    description: str = ""
    duration_minutes: int
    price_cents: int
    currency: str = "EUR"
    active: bool = True
    deposit_required: bool = False
    deposit_amount_cents: int = 0


class ServiceOut(ServiceIn):
    id: int
    provider_id: int


class AvailabilityIn(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time


class AvailabilityOut(AvailabilityIn):
    id: int
    provider_id: int


class SlotOut(BaseModel):
    start_at: datetime
    end_at: datetime


class ProviderSearchOut(ProviderOut):
    next_slot: Optional[datetime] = None
    min_price_cents: Optional[int] = None


class BookingIn(BaseModel):
    service_id: int
    start_at: datetime
    customer_notes: str = ""


class AppointmentOut(BaseModel):
    id: int
    customer_id: int
    provider_id: int
    service_id: int
    start_at: datetime
    end_at: datetime
    status: AppointmentStatus
    total_price_cents: int
    deposit_amount_cents: int = 0
    payment_status: PaymentStatus = PaymentStatus.not_required
    customer_notes: str
    provider_display_name: Optional[str] = None
    service_name: Optional[str] = None
    has_review: bool = False
    can_review: bool = False


class BookingOut(BaseModel):
    appointment: AppointmentOut
    checkout_url: Optional[str] = None  # set if a deposit is required
    payment_id: Optional[int] = None


class ReviewIn(BaseModel):
    appointment_id: int
    rating: int
    comment: str = ""


class ReviewOut(BaseModel):
    id: int
    appointment_id: int
    customer_id: int
    provider_id: int
    rating: int
    comment: str
    created_at: datetime
    customer_first_name: Optional[str] = None
    service_name: Optional[str] = None


TokenOut.model_rebuild()
