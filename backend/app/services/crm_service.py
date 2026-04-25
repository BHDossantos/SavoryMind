from datetime import date
from sqlalchemy.orm import Session
from ..models.restaurant_ext import CRMCustomer
from ..schemas.restaurant_ext import CRMCustomerCreate, CRMCustomerUpdate


def get_customers(db: Session, user_id: int, search: str | None = None) -> list[CRMCustomer]:
    q = db.query(CRMCustomer).filter(CRMCustomer.user_id == user_id)
    if search:
        safe = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        q = q.filter(CRMCustomer.name.ilike(f"%{safe}%"))
    return q.order_by(CRMCustomer.total_visits.desc()).all()


def get_customer(db: Session, user_id: int, customer_id: int) -> CRMCustomer | None:
    return db.query(CRMCustomer).filter(CRMCustomer.id == customer_id, CRMCustomer.user_id == user_id).first()


def create_customer(db: Session, user_id: int, data: CRMCustomerCreate) -> CRMCustomer:
    customer = CRMCustomer(**data.model_dump(), user_id=user_id)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(db: Session, user_id: int, customer_id: int, data: CRMCustomerUpdate) -> CRMCustomer | None:
    customer = get_customer(db, user_id, customer_id)
    if not customer:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, user_id: int, customer_id: int) -> bool:
    customer = get_customer(db, user_id, customer_id)
    if not customer:
        return False
    db.delete(customer)
    db.commit()
    return True


def record_visit(db: Session, user_id: int, customer_id: int, spend: float) -> CRMCustomer | None:
    customer = get_customer(db, user_id, customer_id)
    if not customer:
        return None
    customer.total_visits += 1
    customer.total_spend += spend
    customer.last_visit = date.today()
    db.commit()
    db.refresh(customer)
    return customer


def get_crm_summary(db: Session, user_id: int) -> dict:
    customers = get_customers(db, user_id)
    if not customers:
        return {"total_customers": 0, "vip_count": 0, "avg_spend": 0, "total_revenue": 0}
    vip = [c for c in customers if "vip" in (c.tags or "")]
    total_spend = sum(c.total_spend for c in customers)
    return {
        "total_customers": len(customers),
        "vip_count": len(vip),
        "avg_spend": round(total_spend / len(customers), 2),
        "total_revenue": round(total_spend, 2),
        "top_customers": [
            {"name": c.name, "visits": c.total_visits, "spend": c.total_spend}
            for c in sorted(customers, key=lambda c: c.total_spend, reverse=True)[:5]
        ],
    }
