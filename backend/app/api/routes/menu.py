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
def list_menu_items(db: Session = Depends(get_db)):
    items = menu_service.get_all_items(db)
    result = []
    for item in items:
        margin = ((item.price - item.cost) / item.price * 100) if item.price > 0 else 0
        revenue = item.price * item.orders_last_30_days
        data = MenuItemResponse.model_validate(item)
        data.profit_margin = round(margin, 1)
        data.revenue_last_30_days = round(revenue, 2)
        result.append(data)
    return result


@router.get("/{item_id}", response_model=MenuItemResponse)
def get_menu_item(item_id: int, db: Session = Depends(get_db)):
    item = menu_service.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    margin = ((item.price - item.cost) / item.price * 100) if item.price > 0 else 0
    data = MenuItemResponse.model_validate(item)
    data.profit_margin = round(margin, 1)
    data.revenue_last_30_days = round(item.price * item.orders_last_30_days, 2)
    return data


@router.post("/", response_model=MenuItemResponse, status_code=201)
def create_menu_item(item: MenuItemCreate, db: Session = Depends(get_db)):
    return menu_service.create_item(db, item)


@router.patch("/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: int, update: MenuItemUpdate, db: Session = Depends(get_db)):
    item = menu_service.update_item(db, item_id, update)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.delete("/{item_id}", status_code=204)
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    if not menu_service.delete_item(db, item_id):
        raise HTTPException(status_code=404, detail="Item not found")


@router.get("/recommendations/all")
def get_recommendations(db: Session = Depends(get_db)):
    return menu_service.get_recommendations(db)
