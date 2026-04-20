from pydantic import BaseModel
from datetime import datetime


class MenuItemBase(BaseModel):
    name: str
    category: str
    price: float
    cost: float
    orders_last_30_days: int = 0
    rating: float = 0.0
    description: str = ""


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    price: float | None = None
    cost: float | None = None
    orders_last_30_days: int | None = None
    rating: float | None = None
    description: str | None = None


class MenuItemResponse(MenuItemBase):
    id: int
    created_at: datetime
    profit_margin: float = 0.0
    revenue_last_30_days: float = 0.0

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_menu_items: int
    total_revenue_30_days: float
    avg_profit_margin: float
    avg_rating: float
    top_performer: str
    total_orders_30_days: int
