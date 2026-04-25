from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.diner import DinerReview
from ...schemas.restaurant_ext import (
    BookingCreate, BookingUpdate, BookingResponse,
    CRMCustomerCreate, CRMCustomerUpdate, CRMCustomerResponse,
    StaffCreate, StaffUpdate, StaffResponse,
    SalesPrediction,
)
from ...services import booking_service, crm_service, staff_service, prediction_service, trends_service

router = APIRouter(prefix="/restaurant", tags=["restaurant"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


# --- Bookings ---

@router.get("/bookings/today")
def today_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return booking_service.get_today_summary(db, current_user.id)


@router.get("/bookings", response_model=list[BookingResponse])
def list_bookings(
    filter_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return booking_service.get_bookings(db, current_user.id, filter_date)


@router.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return booking_service.create_booking(db, current_user.id, data)


@router.patch("/bookings/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    data: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    b = booking_service.update_booking(db, current_user.id, booking_id, data)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    if not booking_service.delete_booking(db, current_user.id, booking_id):
        raise HTTPException(status_code=404, detail="Booking not found")


@router.patch("/bookings/{booking_id}/confirm", response_model=BookingResponse)
def confirm_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    b = booking_service.confirm_booking(db, current_user.id, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Online booking not found.")
    return b


@router.patch("/bookings/{booking_id}/decline", response_model=BookingResponse)
def decline_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    b = booking_service.decline_booking(db, current_user.id, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Online booking not found.")
    return b


# --- CRM ---

@router.get("/crm/summary")
def crm_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return crm_service.get_crm_summary(db, current_user.id)


@router.get("/crm", response_model=list[CRMCustomerResponse])
def list_customers(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return crm_service.get_customers(db, current_user.id, search)


@router.post("/crm", response_model=CRMCustomerResponse, status_code=201)
def create_customer(
    data: CRMCustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return crm_service.create_customer(db, current_user.id, data)


@router.patch("/crm/{customer_id}", response_model=CRMCustomerResponse)
def update_customer(
    customer_id: int,
    data: CRMCustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    c = crm_service.update_customer(db, current_user.id, customer_id, data)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.post("/crm/{customer_id}/visit", response_model=CRMCustomerResponse)
def record_visit(
    customer_id: int,
    spend: float = 0.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    c = crm_service.record_visit(db, current_user.id, customer_id, spend)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.delete("/crm/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    if not crm_service.delete_customer(db, current_user.id, customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")


# --- Staff ---

@router.get("/staff/summary")
def staff_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return staff_service.get_performance_summary(db, current_user.id)


@router.get("/staff", response_model=list[StaffResponse])
def list_staff(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return staff_service.get_staff(db, current_user.id)


@router.post("/staff", response_model=StaffResponse, status_code=201)
def create_staff(
    data: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    return staff_service.create_staff(db, current_user.id, data)


@router.patch("/staff/{staff_id}", response_model=StaffResponse)
def update_staff(
    staff_id: int,
    data: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    s = staff_service.update_staff(db, current_user.id, staff_id, data)
    if not s:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return s


@router.delete("/staff/{staff_id}", status_code=204)
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_restaurant(current_user)
    if not staff_service.delete_staff(db, current_user.id, staff_id):
        raise HTTPException(status_code=404, detail="Staff member not found")


# --- Sales Predictions ---

@router.get("/predictions", response_model=SalesPrediction)
def get_predictions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return prediction_service.predict_sales(db, current_user.id)


# --- Trends & Marketing -------------------------------------------------------

@router.get("/trends")
def get_trends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return trends_service.get_menu_trends(db, current_user.id)


@router.get("/marketing")
def get_marketing(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return trends_service.get_marketing_insights(db, current_user.id)


# --- Diner Reviews (submitted by diners about this restaurant) ----------------

@router.get("/diner-reviews")
def get_diner_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    reviews = (
        db.query(DinerReview)
        .filter(DinerReview.restaurant_user_id == current_user.id)
        .order_by(DinerReview.created_at.desc())
        .all()
    )
    avg = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else None
    return {
        "avg_rating": avg,
        "total": len(reviews),
        "reviews": [
            {"id": r.id, "rating": r.rating, "comment": r.comment, "created_at": str(r.created_at)}
            for r in reviews
        ],
    }
