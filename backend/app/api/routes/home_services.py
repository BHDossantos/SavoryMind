"""Home & Local Services API.

Endpoints split by audience:
  /home/providers/me/...   — provider-side (signup, services, jobs feed, bookings)
  /home/customer/...       — customer-side (job requests, quotes, bookings, reviews)
  /home/search/providers   — public search
  /home/categories         — static catalog of supported categories
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.home_services import HOME_SERVICE_CATEGORIES
from ...models.user import User
from ...schemas.home_services import (
    BookingOut,
    BookingStatusUpdate,
    JobRequestCreate,
    JobRequestOut,
    ProviderCreate,
    ProviderPublic,
    ProviderSearchResult,
    ProviderServiceCreate,
    ProviderServiceOut,
    ProviderUpdate,
    QuoteCreate,
    QuoteOut,
    ReviewCreate,
    ReviewOut,
)
from ...services import home_services_service as svc


router = APIRouter(prefix="/home", tags=["home-services"])


# ─── Catalog ──────────────────────────────────────────────────────────────────

@router.get("/categories")
def list_categories():
    return {"categories": HOME_SERVICE_CATEGORIES}


# ─── Provider profile ────────────────────────────────────────────────────────

@router.get("/providers/me", response_model=Optional[ProviderPublic])
def get_my_provider(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return svc.get_provider_for_user(db, user.id)


@router.post("/providers/me", response_model=ProviderPublic, status_code=201)
def upsert_my_provider(
    body: ProviderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.create_or_update_provider(db, user.id, body.model_dump())


@router.patch("/providers/me", response_model=ProviderPublic)
def update_my_provider(
    body: ProviderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc.require_provider(db, user.id)
    return svc.create_or_update_provider(db, user.id, body.model_dump(exclude_none=True))


# ─── Provider service catalog ────────────────────────────────────────────────

@router.get("/providers/me/services", response_model=List[ProviderServiceOut])
def list_my_services(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    provider = svc.require_provider(db, user.id)
    return svc.list_provider_services(db, provider.id)


@router.post("/providers/me/services", response_model=ProviderServiceOut, status_code=201)
def add_my_service(
    body: ProviderServiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider = svc.require_provider(db, user.id)
    return svc.add_provider_service(db, provider, body.model_dump())


@router.delete("/providers/me/services/{service_id}", status_code=204)
def delete_my_service(
    service_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider = svc.require_provider(db, user.id)
    svc.delete_provider_service(db, provider, service_id)


# ─── Provider job feed & bookings ────────────────────────────────────────────

@router.get("/providers/me/jobs", response_model=List[JobRequestOut])
def list_provider_feed(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    provider = svc.require_provider(db, user.id)
    return svc.list_provider_job_feed(db, provider)


@router.get("/providers/me/bookings", response_model=List[BookingOut])
def list_my_provider_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    provider = svc.require_provider(db, user.id)
    return svc.list_provider_bookings(db, provider.id)


# ─── Customer job requests ───────────────────────────────────────────────────

@router.post("/customer/jobs", response_model=JobRequestOut, status_code=201)
def create_job(
    body: JobRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.create_job_request(db, user.id, body.model_dump())


@router.get("/customer/jobs", response_model=List[JobRequestOut])
def list_my_jobs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return svc.list_customer_jobs(db, user.id)


@router.get("/customer/jobs/{job_id}", response_model=JobRequestOut)
def get_my_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return svc.get_job_for_customer(db, user.id, job_id)


@router.post("/customer/jobs/{job_id}/cancel", response_model=JobRequestOut)
def cancel_my_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.cancel_job(db, user.id, job_id)


@router.get("/customer/jobs/{job_id}/quotes", response_model=List[QuoteOut])
def list_quotes_for_my_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    svc.get_job_for_customer(db, user.id, job_id)  # ownership check
    return svc.list_job_quotes(db, job_id)


@router.post("/customer/quotes/{quote_id}/accept", response_model=BookingOut, status_code=201)
def accept_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.accept_quote(db, user.id, quote_id)


@router.get("/customer/bookings", response_model=List[BookingOut])
def list_my_customer_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return svc.list_customer_bookings(db, user.id)


# ─── Provider quote submission ───────────────────────────────────────────────

@router.post("/providers/me/jobs/{job_id}/quote", response_model=QuoteOut, status_code=201)
def submit_quote(
    job_id: int,
    body: QuoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    provider = svc.require_provider(db, user.id)
    return svc.submit_quote(db, provider, job_id, body.model_dump())


# ─── Booking status (used by both sides) ─────────────────────────────────────

@router.post("/bookings/{booking_id}/status", response_model=BookingOut)
def update_booking_status(
    booking_id: int,
    body: BookingStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.update_booking_status(
        db,
        booking_id,
        actor_user_id=user.id,
        new_status=body.status,
        provider_notes=body.provider_notes,
    )


# ─── Reviews ─────────────────────────────────────────────────────────────────

@router.post("/customer/bookings/{booking_id}/review", response_model=ReviewOut, status_code=201)
def review_booking(
    booking_id: int,
    body: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return svc.create_review(db, user.id, booking_id, body.model_dump())


@router.get("/providers/{provider_id}/reviews", response_model=List[ReviewOut])
def get_provider_reviews(provider_id: int, db: Session = Depends(get_db)):
    return svc.list_provider_reviews(db, provider_id)


# ─── Public provider search ──────────────────────────────────────────────────

@router.get("/search/providers", response_model=List[ProviderSearchResult])
def search_providers(
    category: str = Query(...),
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    max_distance_km: float = 25.0,
    language: Optional[str] = None,
    emergency: bool = False,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    results = svc.search_providers(
        db,
        category=category,
        latitude=latitude,
        longitude=longitude,
        max_distance_km=max_distance_km,
        requested_language=language,
        emergency=emergency,
        limit=limit,
    )
    return [ProviderSearchResult(**r) for r in results]
