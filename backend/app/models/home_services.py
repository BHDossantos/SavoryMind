"""Home & Local Services vertical (AvailableNow Home).

Marketplace where customers request cleaning, plumbing, handyman, moving and
similar services and providers respond with quotes or instant bookings.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from datetime import datetime
from ..core.database import Base


# Service catalog ─ canonical categories the platform exposes.
# Stored as a static enum-like list rather than a table to keep the MVP small.
HOME_SERVICE_CATEGORIES = [
    "cleaning",
    "handyman",
    "plumbing",
    "furniture_assembly",
    "moving",
    "painting",
    "appliance_repair",
    "locksmith",
    "gardening",
    "electrical",
    "hvac",
    "pest_control",
    "it_support",
]

# Categories that legally require a license in most jurisdictions. Admin must
# verify documents before a provider can offer them.
LICENSE_REQUIRED_CATEGORIES = {"electrical", "hvac", "plumbing"}


class HomeProvider(Base):
    """Service-provider profile attached to a User account.

    Mirrors the existing pattern (one User row, vertical-specific extension
    rows). A user becomes a home-services provider by creating one of these.
    """

    __tablename__ = "home_providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    business_name = Column(String(150), nullable=True)
    provider_type = Column(String(20), default="individual")  # individual | company
    bio = Column(Text, nullable=True)
    profile_photo_url = Column(String, nullable=True)

    city = Column(String(150), nullable=True)
    country = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    service_radius_km = Column(Float, default=15.0)

    languages = Column(Text, nullable=True)  # JSON array, e.g. ["en","it"]
    categories = Column(Text, nullable=True)  # JSON array of HOME_SERVICE_CATEGORIES

    # Pricing defaults — per-service overrides live on HomeProviderService.
    hourly_rate = Column(Float, nullable=True)
    minimum_fee = Column(Float, nullable=True)
    travel_fee = Column(Float, default=0.0)
    emergency_fee = Column(Float, nullable=True)
    accepts_emergency = Column(Boolean, default=False)

    verified_status = Column(String(20), default="pending")  # pending | verified | rejected
    insurance_status = Column(String(20), default="none")    # none | uploaded | verified
    license_status = Column(String(20), default="none")      # none | uploaded | verified

    average_rating = Column(Float, default=0.0)
    completed_jobs = Column(Integer, default=0)
    reliability_score = Column(Float, default=100.0)  # 0–100
    cancellation_count = Column(Integer, default=0)

    status = Column(String(20), default="active")  # active | suspended | inactive
    created_at = Column(DateTime, default=datetime.utcnow)


class HomeProviderService(Base):
    """A specific service offering a provider sells (e.g. "2-hour deep clean")."""

    __tablename__ = "home_provider_services"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("home_providers.id"), nullable=False, index=True)

    category = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    pricing_type = Column(String(20), default="hourly")  # fixed | hourly | quote_required | diagnostic_fee
    base_price = Column(Float, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    minimum_fee = Column(Float, nullable=True)
    estimated_duration_minutes = Column(Integer, nullable=True)
    materials_included = Column(Boolean, default=False)

    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HomeJobRequest(Base):
    """A customer's request for service. Becomes one or more quotes/bookings."""

    __tablename__ = "home_job_requests"

    id = Column(Integer, primary_key=True, index=True)
    customer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    category = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    photos = Column(Text, nullable=True)  # JSON array of URLs

    address_line = Column(String(255), nullable=True)
    city = Column(String(150), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    property_type = Column(String(50), nullable=True)  # apartment | house | office | airbnb
    access_notes = Column(Text, nullable=True)

    booking_type = Column(String(20), default="quote_request")  # instant | quote_request | emergency | recurring
    urgency = Column(String(20), default="flexible")            # flexible | today | urgent | emergency
    preferred_start = Column(DateTime, nullable=True)
    preferred_end = Column(DateTime, nullable=True)

    budget_min = Column(Float, nullable=True)
    budget_max = Column(Float, nullable=True)
    preferred_language = Column(String(10), nullable=True)

    # When booking_type = instant, customer can target a specific provider directly.
    target_provider_id = Column(Integer, ForeignKey("home_providers.id"), nullable=True)

    status = Column(String(30), default="open")
    # open | quoted | booked | cancelled | completed | expired

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class HomeQuote(Base):
    """A provider's quoted price for a job request."""

    __tablename__ = "home_quotes"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("home_job_requests.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("home_providers.id"), nullable=False, index=True)

    labor_cost = Column(Float, default=0.0)
    materials_cost = Column(Float, default=0.0)
    travel_fee = Column(Float, default=0.0)
    platform_fee = Column(Float, default=0.0)
    total_price = Column(Float, nullable=False)
    currency = Column(String(10), default="EUR")
    estimated_duration_minutes = Column(Integer, nullable=True)
    earliest_start = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    valid_until = Column(DateTime, nullable=True)

    status = Column(String(20), default="submitted")
    # submitted | accepted | rejected | expired | withdrawn

    created_at = Column(DateTime, default=datetime.utcnow)


class HomeBooking(Base):
    """A confirmed job — created when a quote is accepted or instant booking is placed."""

    __tablename__ = "home_bookings"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("home_job_requests.id"), nullable=False, index=True)
    quote_id = Column(Integer, ForeignKey("home_quotes.id"), nullable=True)
    customer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("home_providers.id"), nullable=False, index=True)

    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)

    final_price = Column(Float, nullable=False)
    currency = Column(String(10), default="EUR")
    deposit_amount = Column(Float, default=0.0)
    payment_status = Column(String(20), default="pending")
    # pending | deposit_paid | paid | refunded

    status = Column(String(30), default="confirmed")
    # pending | confirmed | provider_on_way | arrived | in_progress |
    # completed | cancelled_by_customer | cancelled_by_provider | disputed

    customer_notes = Column(Text, nullable=True)
    provider_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class HomeReview(Base):
    """Customer review left after a completed booking."""

    __tablename__ = "home_reviews"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("home_bookings.id"), nullable=False, unique=True, index=True)
    customer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider_id = Column(Integer, ForeignKey("home_providers.id"), nullable=False, index=True)

    rating = Column(Float, nullable=False)            # 1–5 overall
    quality_rating = Column(Float, nullable=True)
    punctuality_rating = Column(Float, nullable=True)
    communication_rating = Column(Float, nullable=True)
    price_accuracy_rating = Column(Float, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
