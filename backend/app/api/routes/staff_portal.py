from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user, hash_password
from ...models.user import User
from ...services import staff_time_service
from ...services import employee_survey_service

router = APIRouter(prefix="/staff", tags=["staff-portal"])


def _require_staff(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "staff":
        raise HTTPException(status_code=403, detail="Staff accounts only.")
    if not user.employer_id:
        raise HTTPException(status_code=400, detail="Staff account not linked to a restaurant.")
    return user


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
def clock_status(user: User = Depends(_require_staff), db: Session = Depends(get_db)):
    open_entry = staff_time_service.get_open_entry(db, user.employer_id, user.id)
    return {
        "clocked_in": open_entry is not None,
        "clock_in_time": open_entry.clock_in if open_entry else None,
        "clock_in_date": open_entry.date if open_entry else None,
        "entry_id": open_entry.id if open_entry else None,
    }


# ── Clock In ──────────────────────────────────────────────────────────────────

class ClockInBody(BaseModel):
    notes: Optional[str] = Field(default="", max_length=300)


@router.post("/clock-in")
def clock_in(body: ClockInBody, user: User = Depends(_require_staff), db: Session = Depends(get_db)):
    entry = staff_time_service.clock_in(
        db, employer_id=user.employer_id, staff_user_id=user.id,
        staff_name=user.display_name, notes=body.notes or ""
    )
    return {"message": "Clocked in", "clock_in": entry.clock_in, "date": entry.date, "id": entry.id}


# ── Clock Out ─────────────────────────────────────────────────────────────────

class ClockOutBody(BaseModel):
    break_minutes: int = Field(default=0, ge=0)


@router.post("/clock-out")
def clock_out(body: ClockOutBody, user: User = Depends(_require_staff), db: Session = Depends(get_db)):
    entry = staff_time_service.clock_out(db, employer_id=user.employer_id, staff_user_id=user.id, break_minutes=body.break_minutes)
    if not entry:
        raise HTTPException(status_code=400, detail="Not currently clocked in.")
    return {
        "message": "Clocked out",
        "clock_in": entry.clock_in,
        "clock_out": entry.clock_out,
        "total_hours": entry.total_hours,
        "break_minutes": entry.break_minutes,
    }


# ── My Logs ───────────────────────────────────────────────────────────────────

@router.get("/my-logs")
def my_logs(user: User = Depends(_require_staff), db: Session = Depends(get_db)):
    return staff_time_service.get_staff_own_logs(db, employer_id=user.employer_id, staff_user_id=user.id)


# ── Employee account management (called by restaurant owners) ─────────────────

class EmployeeCreate(BaseModel):
    display_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=6, max_length=100)


def _require_restaurant(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant accounts only.")
    return user


@router.post("/employees", status_code=201)
def create_employee(body: EmployeeCreate, owner: User = Depends(_require_restaurant), db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered.")
    emp = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        account_type="staff",
        display_name=body.display_name,
        employer_id=owner.id,
        onboarding_completed=True,
        qr_token=employee_survey_service.generate_qr_token(),
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return {
        "id": emp.id,
        "display_name": emp.display_name,
        "email": emp.email,
        "employer_id": emp.employer_id,
        "qr_token": emp.qr_token,
    }


@router.get("/employees")
def list_employees(owner: User = Depends(_require_restaurant), db: Session = Depends(get_db)):
    emps = db.query(User).filter(User.employer_id == owner.id, User.account_type == "staff").all()
    return [{"id": e.id, "display_name": e.display_name, "email": e.email} for e in emps]


@router.delete("/employees/{emp_id}", status_code=204)
def delete_employee(emp_id: int, owner: User = Depends(_require_restaurant), db: Session = Depends(get_db)):
    emp = db.query(User).filter(User.id == emp_id, User.employer_id == owner.id, User.account_type == "staff").first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    db.delete(emp)
    db.commit()
