"""Business logic for the Home & Local Services vertical."""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models.home_services import (
    HomeBooking,
    HomeJobRequest,
    HomeProvider,
    HomeProviderService,
    HomeQuote,
    HomeReview,
    HOME_SERVICE_CATEGORIES,
    LICENSE_REQUIRED_CATEGORIES,
)


PLATFORM_FEE_RATE = 0.15  # 15% platform commission


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _dump_list(values: Optional[List[str]]) -> Optional[str]:
    if values is None:
        return None
    return json.dumps(values)


def _load_list(payload: Optional[str]) -> List[str]:
    if not payload:
        return []
    try:
        data = json.loads(payload)
        return data if isinstance(data, list) else []
    except (TypeError, ValueError):
        return []


def _haversine_km(lat1, lon1, lat2, lon2) -> Optional[float]:
    if None in (lat1, lon1, lat2, lon2):
        return None
    r = 6371.0
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = lat2_r - lat1_r
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _validate_category(category: str) -> None:
    if category not in HOME_SERVICE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown service category: {category}")


def _ensure_license_ok(provider: HomeProvider, category: str) -> None:
    """Block providers from offering licensed work without a verified license."""
    if category in LICENSE_REQUIRED_CATEGORIES and provider.license_status != "verified":
        raise HTTPException(
            status_code=403,
            detail=f"License verification required to offer '{category}'.",
        )


# ─── Provider profile ─────────────────────────────────────────────────────────

def get_provider_for_user(db: Session, user_id: int) -> Optional[HomeProvider]:
    return db.query(HomeProvider).filter(HomeProvider.user_id == user_id).first()


def require_provider(db: Session, user_id: int) -> HomeProvider:
    provider = get_provider_for_user(db, user_id)
    if not provider:
        raise HTTPException(status_code=404, detail="No provider profile for this user.")
    if provider.status == "suspended":
        raise HTTPException(status_code=403, detail="Provider account is suspended.")
    return provider


def create_or_update_provider(db: Session, user_id: int, payload: dict) -> HomeProvider:
    for cat in payload.get("categories") or []:
        _validate_category(cat)

    provider = get_provider_for_user(db, user_id)
    payload = dict(payload)
    payload["languages"] = _dump_list(payload.get("languages"))
    payload["categories"] = _dump_list(payload.get("categories"))

    if provider is None:
        provider = HomeProvider(user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
        db.add(provider)
    else:
        for key, value in payload.items():
            if value is not None:
                setattr(provider, key, value)

    db.commit()
    db.refresh(provider)
    return provider


# ─── Provider service catalog ─────────────────────────────────────────────────

def list_provider_services(db: Session, provider_id: int) -> List[HomeProviderService]:
    return (
        db.query(HomeProviderService)
        .filter(HomeProviderService.provider_id == provider_id)
        .order_by(HomeProviderService.id.desc())
        .all()
    )


def add_provider_service(db: Session, provider: HomeProvider, payload: dict) -> HomeProviderService:
    _validate_category(payload["category"])
    _ensure_license_ok(provider, payload["category"])
    svc = HomeProviderService(provider_id=provider.id, **payload)
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


def delete_provider_service(db: Session, provider: HomeProvider, service_id: int) -> bool:
    svc = (
        db.query(HomeProviderService)
        .filter(HomeProviderService.id == service_id,
                HomeProviderService.provider_id == provider.id)
        .first()
    )
    if not svc:
        return False
    db.delete(svc)
    db.commit()
    return True


# ─── Job requests ─────────────────────────────────────────────────────────────

def create_job_request(db: Session, customer_user_id: int, payload: dict) -> HomeJobRequest:
    _validate_category(payload["category"])
    payload = dict(payload)
    payload["photos"] = _dump_list(payload.get("photos"))

    job = HomeJobRequest(customer_user_id=customer_user_id, **payload)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def list_customer_jobs(db: Session, customer_user_id: int) -> List[HomeJobRequest]:
    return (
        db.query(HomeJobRequest)
        .filter(HomeJobRequest.customer_user_id == customer_user_id)
        .order_by(HomeJobRequest.created_at.desc())
        .all()
    )


def get_job_for_customer(db: Session, customer_user_id: int, job_id: int) -> HomeJobRequest:
    job = db.query(HomeJobRequest).filter(HomeJobRequest.id == job_id).first()
    if not job or job.customer_user_id != customer_user_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


def cancel_job(db: Session, customer_user_id: int, job_id: int) -> HomeJobRequest:
    job = get_job_for_customer(db, customer_user_id, job_id)
    if job.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in status {job.status}.")
    job.status = "cancelled"
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


# ─── Provider job feed ────────────────────────────────────────────────────────

def list_provider_job_feed(db: Session, provider: HomeProvider) -> List[HomeJobRequest]:
    """Open jobs in this provider's categories (or directly targeted at them)."""
    categories = _load_list(provider.categories)
    query = db.query(HomeJobRequest).filter(HomeJobRequest.status == "open")
    if categories:
        query = query.filter(
            or_(
                HomeJobRequest.category.in_(categories),
                HomeJobRequest.target_provider_id == provider.id,
            )
        )
    else:
        query = query.filter(HomeJobRequest.target_provider_id == provider.id)
    return query.order_by(HomeJobRequest.created_at.desc()).limit(50).all()


# ─── Matching / search ────────────────────────────────────────────────────────

def _match_score(
    provider: HomeProvider,
    *,
    distance_km: Optional[float],
    radius_limit_km: float,
    requested_language: Optional[str],
) -> float:
    """Composite score 0–100. Higher is better."""
    rating = provider.average_rating or 0.0
    rating_score = (rating / 5.0) * 100 if rating else 50.0

    reliability_score = provider.reliability_score or 50.0

    if distance_km is None:
        distance_score = 60.0
    else:
        ratio = max(0.0, 1.0 - (distance_km / max(radius_limit_km, 1.0)))
        distance_score = ratio * 100.0

    completed = provider.completed_jobs or 0
    experience_score = min(100.0, completed * 4.0)  # caps at 25 jobs

    languages = _load_list(provider.languages)
    if requested_language:
        language_score = 100.0 if requested_language in languages else 40.0
    else:
        language_score = 80.0

    return (
        rating_score * 0.25
        + reliability_score * 0.20
        + distance_score * 0.25
        + experience_score * 0.15
        + language_score * 0.15
    )


def search_providers(
    db: Session,
    *,
    category: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    max_distance_km: float = 25.0,
    requested_language: Optional[str] = None,
    emergency: bool = False,
    limit: int = 20,
) -> List[dict]:
    _validate_category(category)
    candidates = (
        db.query(HomeProvider)
        .filter(HomeProvider.status == "active")
        .all()
    )

    results: List[dict] = []
    for p in candidates:
        if category not in _load_list(p.categories):
            continue
        if emergency and not p.accepts_emergency:
            continue
        if category in LICENSE_REQUIRED_CATEGORIES and p.license_status != "verified":
            continue

        distance = _haversine_km(latitude, longitude, p.latitude, p.longitude)
        if distance is not None and distance > max_distance_km:
            continue

        score = _match_score(
            p,
            distance_km=distance,
            radius_limit_km=max_distance_km,
            requested_language=requested_language,
        )

        # Cheap price hint based on the provider's hourly rate (or first matching service).
        price_hint = p.hourly_rate
        if price_hint is None:
            svc = (
                db.query(HomeProviderService)
                .filter(HomeProviderService.provider_id == p.id,
                        HomeProviderService.category == category,
                        HomeProviderService.active.is_(True))
                .first()
            )
            if svc:
                price_hint = svc.base_price or svc.hourly_rate

        results.append(
            {
                "provider": p,
                "distance_km": round(distance, 2) if distance is not None else None,
                "match_score": round(score, 2),
                "price_estimate": price_hint,
            }
        )

    results.sort(key=lambda r: r["match_score"], reverse=True)
    return results[:limit]


# ─── Quotes ───────────────────────────────────────────────────────────────────

def submit_quote(
    db: Session,
    provider: HomeProvider,
    job_id: int,
    payload: dict,
) -> HomeQuote:
    job = db.query(HomeJobRequest).filter(HomeJobRequest.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status not in {"open", "quoted"}:
        raise HTTPException(status_code=409, detail=f"Cannot quote job in status {job.status}.")
    if job.category not in _load_list(provider.categories):
        raise HTTPException(status_code=403, detail="Provider does not offer this category.")
    _ensure_license_ok(provider, job.category)

    existing = (
        db.query(HomeQuote)
        .filter(HomeQuote.job_id == job_id, HomeQuote.provider_id == provider.id)
        .first()
    )
    if existing and existing.status == "submitted":
        raise HTTPException(status_code=409, detail="You already submitted a quote for this job.")

    subtotal = (payload.get("labor_cost") or 0) + (payload.get("materials_cost") or 0) + (payload.get("travel_fee") or 0)
    platform_fee = round(subtotal * PLATFORM_FEE_RATE, 2)
    total_price = round(subtotal + platform_fee, 2)

    quote = HomeQuote(
        job_id=job_id,
        provider_id=provider.id,
        labor_cost=payload.get("labor_cost") or 0,
        materials_cost=payload.get("materials_cost") or 0,
        travel_fee=payload.get("travel_fee") or 0,
        platform_fee=platform_fee,
        total_price=total_price,
        currency=payload.get("currency") or "EUR",
        estimated_duration_minutes=payload.get("estimated_duration_minutes"),
        earliest_start=payload.get("earliest_start"),
        notes=payload.get("notes"),
        valid_until=payload.get("valid_until") or (datetime.utcnow() + timedelta(days=7)),
    )
    db.add(quote)

    if job.status == "open":
        job.status = "quoted"
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(quote)
    return quote


def list_job_quotes(db: Session, job_id: int) -> List[HomeQuote]:
    return (
        db.query(HomeQuote)
        .filter(HomeQuote.job_id == job_id)
        .order_by(HomeQuote.total_price.asc())
        .all()
    )


def accept_quote(db: Session, customer_user_id: int, quote_id: int) -> HomeBooking:
    quote = db.query(HomeQuote).filter(HomeQuote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found.")
    job = db.query(HomeJobRequest).filter(HomeJobRequest.id == quote.job_id).first()
    if not job or job.customer_user_id != customer_user_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if quote.status != "submitted":
        raise HTTPException(status_code=409, detail=f"Quote status is {quote.status}.")

    quote.status = "accepted"
    job.status = "booked"
    job.updated_at = datetime.utcnow()

    # Reject every other open quote for this job.
    other_quotes = (
        db.query(HomeQuote)
        .filter(HomeQuote.job_id == job.id, HomeQuote.id != quote.id, HomeQuote.status == "submitted")
        .all()
    )
    for q in other_quotes:
        q.status = "rejected"

    deposit = round(quote.total_price * 0.20, 2)
    booking = HomeBooking(
        job_id=job.id,
        quote_id=quote.id,
        customer_user_id=customer_user_id,
        provider_id=quote.provider_id,
        scheduled_start=quote.earliest_start or job.preferred_start,
        scheduled_end=None,
        final_price=quote.total_price,
        currency=quote.currency,
        deposit_amount=deposit,
        payment_status="pending",
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


# ─── Bookings ─────────────────────────────────────────────────────────────────

def list_customer_bookings(db: Session, customer_user_id: int) -> List[HomeBooking]:
    return (
        db.query(HomeBooking)
        .filter(HomeBooking.customer_user_id == customer_user_id)
        .order_by(HomeBooking.created_at.desc())
        .all()
    )


def list_provider_bookings(db: Session, provider_id: int) -> List[HomeBooking]:
    return (
        db.query(HomeBooking)
        .filter(HomeBooking.provider_id == provider_id)
        .order_by(HomeBooking.created_at.desc())
        .all()
    )


def update_booking_status(
    db: Session,
    booking_id: int,
    *,
    actor_user_id: int,
    new_status: str,
    provider_notes: Optional[str] = None,
) -> HomeBooking:
    booking = db.query(HomeBooking).filter(HomeBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    provider = db.query(HomeProvider).filter(HomeProvider.id == booking.provider_id).first()
    is_provider = provider and provider.user_id == actor_user_id
    is_customer = booking.customer_user_id == actor_user_id
    if not (is_provider or is_customer):
        raise HTTPException(status_code=403, detail="Not allowed to update this booking.")

    customer_only = {"cancelled_by_customer"}
    provider_only = {
        "provider_on_way",
        "arrived",
        "in_progress",
        "completed",
        "cancelled_by_provider",
    }
    shared = {"disputed"}

    if new_status in customer_only and not is_customer:
        raise HTTPException(status_code=403, detail="Only the customer can perform this action.")
    if new_status in provider_only and not is_provider:
        raise HTTPException(status_code=403, detail="Only the provider can perform this action.")
    if new_status not in customer_only | provider_only | shared:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    booking.status = new_status
    booking.updated_at = datetime.utcnow()
    if provider_notes is not None:
        booking.provider_notes = provider_notes

    if new_status == "completed" and provider:
        provider.completed_jobs = (provider.completed_jobs or 0) + 1
        booking.payment_status = "paid"

    db.commit()
    db.refresh(booking)
    return booking


# ─── Reviews ──────────────────────────────────────────────────────────────────

def create_review(
    db: Session,
    customer_user_id: int,
    booking_id: int,
    payload: dict,
) -> HomeReview:
    booking = db.query(HomeBooking).filter(HomeBooking.id == booking_id).first()
    if not booking or booking.customer_user_id != customer_user_id:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "completed":
        raise HTTPException(status_code=409, detail="Booking must be completed before reviewing.")
    existing = db.query(HomeReview).filter(HomeReview.booking_id == booking_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Booking already reviewed.")

    review = HomeReview(
        booking_id=booking_id,
        customer_user_id=customer_user_id,
        provider_id=booking.provider_id,
        **payload,
    )
    db.add(review)

    # Recompute provider average rating including this review.
    provider = db.query(HomeProvider).filter(HomeProvider.id == booking.provider_id).first()
    if provider:
        ratings = (
            db.query(HomeReview.rating)
            .filter(HomeReview.provider_id == provider.id)
            .all()
        )
        scores = [r[0] for r in ratings] + [payload["rating"]]
        provider.average_rating = round(sum(scores) / len(scores), 2)

    db.commit()
    db.refresh(review)
    return review


def list_provider_reviews(db: Session, provider_id: int) -> List[HomeReview]:
    return (
        db.query(HomeReview)
        .filter(HomeReview.provider_id == provider_id)
        .order_by(HomeReview.created_at.desc())
        .all()
    )
