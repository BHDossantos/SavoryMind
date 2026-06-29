from sqlalchemy.orm import Session
from ..models.restaurant_ext import Staff
from ..schemas.restaurant_ext import StaffCreate, StaffUpdate


def get_staff(db: Session, user_id: int, active_only: bool = False) -> list[Staff]:
    q = db.query(Staff).filter(Staff.user_id == user_id)
    if active_only:
        q = q.filter(Staff.active == True)
    return q.order_by(Staff.name).all()


def get_staff_member(db: Session, user_id: int, staff_id: int) -> Staff | None:
    return db.query(Staff).filter(Staff.id == staff_id, Staff.user_id == user_id).first()


def create_staff(db: Session, user_id: int, data: StaffCreate) -> Staff:
    member = Staff(**data.model_dump(), user_id=user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_staff(db: Session, user_id: int, staff_id: int, data: StaffUpdate) -> Staff | None:
    member = get_staff_member(db, user_id, staff_id)
    if not member:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


def delete_staff(db: Session, user_id: int, staff_id: int) -> bool:
    member = get_staff_member(db, user_id, staff_id)
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True


def get_performance_summary(db: Session, user_id: int) -> dict:
    staff = get_staff(db, user_id, active_only=True)
    if not staff:
        return {"total_staff": 0, "avg_rating": 0, "top_performer": None}
    avg_rating = sum(s.rating for s in staff) / len(staff)
    top = max(staff, key=lambda s: s.rating)
    return {
        "total_staff": len(staff),
        "avg_rating": round(avg_rating, 2),
        "top_performer": top.name,
        "by_role": _group_by_role(staff),
    }


def _group_by_role(staff: list[Staff]) -> dict:
    roles: dict[str, int] = {}
    for s in staff:
        roles[s.role] = roles.get(s.role, 0) + 1
    return roles
