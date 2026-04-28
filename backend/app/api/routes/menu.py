from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...schemas.menu import MenuItemCreate, MenuItemUpdate, MenuItemResponse, DashboardStats
from ...services import menu_service
from ...models.user import User

router = APIRouter(prefix="/menu", tags=["menu"])


def _require_restaurant(user: User) -> User:
    if user.account_type != "restaurant":
        raise HTTPException(status_code=403, detail="Restaurant account required.")
    return user


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return menu_service.get_dashboard_stats(db, current_user.id)


@router.get("/", response_model=list[MenuItemResponse])
def list_menu_items(category: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    items = menu_service.get_all_items(db, current_user.id, category=category)
    result = []
    for item in items:
        data = MenuItemResponse.model_validate(item)
        data.profit_margin = menu_service._compute_margin(item.price, item.cost)
        data.revenue_last_30_days = menu_service._compute_revenue(item.price, item.orders_last_30_days)
        result.append(data)
    return result


@router.get("/recommendations/all")
def get_recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    return menu_service.get_recommendations(db, current_user.id)


@router.get("/{item_id}", response_model=MenuItemResponse)
def get_menu_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    item = menu_service.get_item(db, current_user.id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    data = MenuItemResponse.model_validate(item)
    data.profit_margin = menu_service._compute_margin(item.price, item.cost)
    data.revenue_last_30_days = menu_service._compute_revenue(item.price, item.orders_last_30_days)
    return data


@router.post("/", response_model=MenuItemResponse, status_code=201)
def create_menu_item(item: MenuItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    created = menu_service.create_item(db, current_user.id, item)
    data = MenuItemResponse.model_validate(created)
    data.profit_margin = menu_service._compute_margin(created.price, created.cost)
    data.revenue_last_30_days = menu_service._compute_revenue(created.price, created.orders_last_30_days)
    return data


@router.patch("/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: int, update: MenuItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    item = menu_service.update_item(db, current_user.id, item_id, update)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    data = MenuItemResponse.model_validate(item)
    data.profit_margin = menu_service._compute_margin(item.price, item.cost)
    data.revenue_last_30_days = menu_service._compute_revenue(item.price, item.orders_last_30_days)
    return data


@router.delete("/{item_id}", status_code=204)
def delete_menu_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_restaurant(current_user)
    if not menu_service.delete_item(db, current_user.id, item_id):
        raise HTTPException(status_code=404, detail="Item not found")
