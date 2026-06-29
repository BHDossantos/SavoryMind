from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime

VALID_CATEGORIES = {"Mains", "Starters", "Desserts", "Drinks"}


class MenuItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str
    price: float = Field(gt=0)
    cost: float = Field(ge=0)
    orders_last_30_days: int = Field(default=0, ge=0)
    rating: float = Field(default=0.0, ge=0.0, le=5.0)
    description: str = Field(default="", max_length=500)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(VALID_CATEGORIES)}")
        return v

    @model_validator(mode="after")
    def cost_less_than_price(self) -> "MenuItemBase":
        if self.cost >= self.price:
            raise ValueError("cost must be less than price")
        return self


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = None
    price: float | None = Field(default=None, gt=0)
    cost: float | None = Field(default=None, ge=0)
    orders_last_30_days: int | None = Field(default=None, ge=0)
    rating: float | None = Field(default=None, ge=0.0, le=5.0)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(VALID_CATEGORIES)}")
        return v

    @model_validator(mode="after")
    def cost_less_than_price(self) -> "MenuItemUpdate":
        if self.cost is not None and self.price is not None and self.cost >= self.price:
            raise ValueError("cost must be less than price")
        return self


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
