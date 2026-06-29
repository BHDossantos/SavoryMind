"""Employee QR-survey endpoints.

Mixes public (no-auth) and authenticated routes intentionally — the
public ones are the diner-facing scan flow, the authenticated ones are
the restaurant owner's management surface. Splitting them across two
routers would scatter the survey domain across two files for no real
gain.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services import employee_survey_service as svc


router = APIRouter(prefix="/employee-survey", tags=["employee-survey"])


# ── Public (no auth) ─────────────────────────────────────────────────────────

@router.get("/{qr_token}")
def get_survey_for_token(qr_token: str, db: Session = Depends(get_db)):
    """Looks up the employee + restaurant for this QR and returns the
    survey to render. No auth — anyone with the printed code can hit it,
    which is the whole point."""
    employee = svc.get_employee_by_qr_token(db, qr_token)
    if not employee:
        raise HTTPException(status_code=404, detail="Invalid or expired QR code.")
    restaurant = svc.get_restaurant_for_employee(db, employee)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant for this QR is no longer active.")
    return {
        "employee": {
            "id": employee.id,
            "display_name": employee.display_name,
        },
        "restaurant": {
            "id": restaurant.id,
            "display_name": restaurant.display_name,
            "restaurant_name": restaurant.restaurant_name,
        },
        "survey": svc.SURVEY_DEFINITION,
    }


class SurveySubmission(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    # Loose typing — validate_answers() in the service does the real
    # per-question coercion. Trying to express that in Pydantic would
    # require either Any or a discriminated union we'd have to keep in
    # sync with the question list by hand.
    answers: dict[str, Any]


@router.post("/{qr_token}/submit", status_code=201)
def submit_survey(qr_token: str, body: SurveySubmission, db: Session = Depends(get_db)):
    employee = svc.get_employee_by_qr_token(db, qr_token)
    if not employee:
        raise HTTPException(status_code=404, detail="Invalid or expired QR code.")
    try:
        cleaned = svc.validate_answers(body.answers)
        row = svc.store_response(db, employee, body.device_id, cleaned)
    except svc.SurveyValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {
        "id": row.id,
        "message": "Thanks — your feedback was sent to the restaurant.",
    }


# ── Restaurant owner (authenticated) ────────────────────────────────────────

def _require_restaurant(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant accounts only.")
    return user


@router.get("/owner/employees")
def list_employees_with_tokens(
    owner: User = Depends(_require_restaurant),
    db: Session = Depends(get_db),
):
    """List of this restaurant's employees with their qr_token. The
    frontend renders a QR per row (client-side) and prints them. Tokens
    are lazy-set here so any staff row missing one gets fixed on first
    view rather than requiring an admin tool."""
    employees = (
        db.query(User)
        .filter(User.employer_id == owner.id, User.account_type == "staff")
        .all()
    )
    out = []
    for emp in employees:
        token = svc.ensure_qr_token(db, emp)
        out.append({
            "id": emp.id,
            "display_name": emp.display_name,
            "email": emp.email,
            "qr_token": token,
        })
    return out


@router.get("/owner/employees/{emp_id}/results")
def employee_results(
    emp_id: int,
    owner: User = Depends(_require_restaurant),
    db: Session = Depends(get_db),
):
    emp = (
        db.query(User)
        .filter(User.id == emp_id, User.employer_id == owner.id, User.account_type == "staff")
        .first()
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return {
        "employee": {"id": emp.id, "display_name": emp.display_name},
        "survey": svc.SURVEY_DEFINITION,
        "stats": svc.aggregate_for_employee(db, emp.id),
    }
