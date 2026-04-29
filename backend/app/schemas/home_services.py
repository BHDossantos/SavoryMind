"""Pydantic schemas for the Home & Local Services vertical."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Provider profile ─────────────────────────────────────────────────────────

class ProviderCreate(BaseModel):
    business_name: Optional[str] = Field(default=None, max_length=150)
    provider_type: str = Field(default="individual", pattern="^(individual|company)$")
    bio: Optional[str] = Field(default=None, max_length=2000)
    profile_photo_url: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=150)
    country: Optional[str] = Field(default=None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_radius_km: float = Field(default=15.0, ge=0, le=200)
    languages: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    hourly_rate: Optional[float] = Field(default=None, ge=0)
    minimum_fee: Optional[float] = Field(default=None, ge=0)
    travel_fee: float = Field(default=0.0, ge=0)
    emergency_fee: Optional[float] = Field(default=None, ge=0)
    accepts_emergency: bool = False


class ProviderUpdate(ProviderCreate):
    provider_type: Optional[str] = Field(default=None, pattern="^(individual|company)$")
    service_radius_km: Optional[float] = Field(default=None, ge=0, le=200)
    travel_fee: Optional[float] = Field(default=None, ge=0)
    accepts_emergency: Optional[bool] = None


class ProviderPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    business_name: Optional[str]
    provider_type: str
    bio: Optional[str]
    profile_photo_url: Optional[str]
    city: Optional[str]
    country: Optional[str]
    languages: Optional[str]
    categories: Optional[str]
    hourly_rate: Optional[float]
    minimum_fee: Optional[float]
    travel_fee: float
    accepts_emergency: bool
    verified_status: str
    average_rating: float
    completed_jobs: int
    reliability_score: float


# ─── Provider services (catalog rows) ─────────────────────────────────────────

class ProviderServiceCreate(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)
    pricing_type: str = Field(default="hourly",
                              pattern="^(fixed|hourly|quote_required|diagnostic_fee)$")
    base_price: Optional[float] = Field(default=None, ge=0)
    hourly_rate: Optional[float] = Field(default=None, ge=0)
    minimum_fee: Optional[float] = Field(default=None, ge=0)
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=0)
    materials_included: bool = False


class ProviderServiceOut(ProviderServiceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    active: bool


# ─── Job requests ─────────────────────────────────────────────────────────────

class JobRequestCreate(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    photos: List[str] = Field(default_factory=list)

    address_line: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=150)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    country: Optional[str] = Field(default=None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    property_type: Optional[str] = Field(default=None, max_length=50)
    access_notes: Optional[str] = Field(default=None, max_length=1000)

    booking_type: str = Field(default="quote_request",
                              pattern="^(instant|quote_request|emergency|recurring)$")
    urgency: str = Field(default="flexible",
                         pattern="^(flexible|today|urgent|emergency)$")
    preferred_start: Optional[datetime] = None
    preferred_end: Optional[datetime] = None

    budget_min: Optional[float] = Field(default=None, ge=0)
    budget_max: Optional[float] = Field(default=None, ge=0)
    preferred_language: Optional[str] = Field(default=None, max_length=10)
    target_provider_id: Optional[int] = None


class JobRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_user_id: int
    category: str
    title: str
    description: Optional[str]
    photos: Optional[str]
    city: Optional[str]
    booking_type: str
    urgency: str
    preferred_start: Optional[datetime]
    preferred_end: Optional[datetime]
    budget_min: Optional[float]
    budget_max: Optional[float]
    target_provider_id: Optional[int]
    status: str
    created_at: datetime


# ─── Quotes ───────────────────────────────────────────────────────────────────

class QuoteCreate(BaseModel):
    labor_cost: float = Field(default=0.0, ge=0)
    materials_cost: float = Field(default=0.0, ge=0)
    travel_fee: float = Field(default=0.0, ge=0)
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=0)
    earliest_start: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    valid_until: Optional[datetime] = None
    currency: str = Field(default="EUR", max_length=10)


class QuoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    provider_id: int
    labor_cost: float
    materials_cost: float
    travel_fee: float
    platform_fee: float
    total_price: float
    currency: str
    estimated_duration_minutes: Optional[int]
    earliest_start: Optional[datetime]
    notes: Optional[str]
    valid_until: Optional[datetime]
    status: str
    created_at: datetime


# ─── Bookings ─────────────────────────────────────────────────────────────────

class BookingStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(provider_on_way|arrived|in_progress|completed|"
                "cancelled_by_customer|cancelled_by_provider|disputed)$"
    )
    provider_notes: Optional[str] = Field(default=None, max_length=2000)


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    quote_id: Optional[int]
    customer_user_id: int
    provider_id: int
    scheduled_start: Optional[datetime]
    scheduled_end: Optional[datetime]
    final_price: float
    currency: str
    deposit_amount: float
    payment_status: str
    status: str
    created_at: datetime


# ─── Reviews ──────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    rating: float = Field(ge=1, le=5)
    quality_rating: Optional[float] = Field(default=None, ge=1, le=5)
    punctuality_rating: Optional[float] = Field(default=None, ge=1, le=5)
    communication_rating: Optional[float] = Field(default=None, ge=1, le=5)
    price_accuracy_rating: Optional[float] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)


class ReviewOut(ReviewCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_id: int
    provider_id: int
    customer_user_id: int
    created_at: datetime


# ─── Search ───────────────────────────────────────────────────────────────────

class ProviderSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: ProviderPublic
    distance_km: Optional[float] = None
    match_score: float
    price_estimate: Optional[float] = None
