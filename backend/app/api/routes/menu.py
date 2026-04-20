from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...schemas.menu import MenuItemCreate, MenuItemUpdate, MenuItemResponse, DashboardStats
from ...services import menu_service

router = APIRouter(prefix="/menu", tags=["menu"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    return menu_service.get_dashboard_stats(db)


@router.get("/", response_model=list[MenuItemResponse])
def list_menu_items(category: Optional[str] = None, db: Session = Depends(get_db)):
    items = menu_service.get_all_items(db, category=category)
    result = []
    for item in items:
        data = MenuItemResponse.model_validate(item)
        data.profit_margin = menu_service._compute_margin(item.price, item.cost)
        data.revenue_last_30_days = menu_service._compute_revenue(item.price, item.orders_last_30_days)
        result.append(data)
    return result


@router.get("/recommendations/all")
def get_recommendations(db: Session = Depends(get_db)):
    return menu_service.get_recommendations(db)


@router.get("/{item_id}", response_model=MenuItemResponse)
def get_menu_item(item_id: int, db: Session = Depends(get_db)):
    item = menu_service.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    data = MenuItemResponse.model_validate(item)
    data.profit_margin = menu_service._compute_margin(item.price, item.cost)
    data.revenue_last_30_days = menu_service._compute_revenue(item.price, item.orders_last_30_days)
    return data


@router.post("/", response_model=MenuItemResponse, status_code=201)
def create_menu_item(item: MenuItemCreate, db: Session = Depends(get_db)):
    created = menu_service.create_item(db, item)
    data = MenuItemResponse.model_validate(created)
    data.profit_margin = menu_service._compute_margin(created.price, created.cost)
    data.revenue_last_30_days = menu_service._compute_revenue(created.price, created.orders_last_30_days)
    return data


@router.patch("/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: int, update: MenuItemUpdate, db: Session = Depends(get_db)):
    item = menu_service.update_item(db, item_id, update)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    data = MenuItemResponse.model_validate(item)
    data.profit_margin = menu_service._compute_margin(item.price, item.cost)
    data.revenue_last_30_days = menu_service._compute_revenue(item.price, item.orders_last_30_days)
    return data


@router.delete("/{item_id}", status_code=204)
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    if not menu_service.delete_item(db, item_id):
        raise HTTPException(status_code=404, detail="Item not found")
