from pydantic import BaseModel


class CategoryBreakdown(BaseModel):
    category: str
    item_count: int
    avg_price: float
    avg_cost: float
    avg_margin: float
    total_orders: int
    total_revenue: float
    avg_rating: float


class SentimentTrend(BaseModel):
    month: str
    positive: int
    neutral: int
    negative: int
    total: int


class TopItem(BaseModel):
    name: str
    category: str
    value: float


class ReportSummary(BaseModel):
    category_breakdown: list[CategoryBreakdown]
    sentiment_trend: list[SentimentTrend]
    top_5_by_revenue: list[TopItem]
    bottom_5_by_margin: list[TopItem]
    total_menu_items: int
    total_reviews: int
    price_range_min: float
    price_range_max: float
