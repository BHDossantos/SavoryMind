from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.menu import MenuItem
from ...models.review import Review
from ...models.user import User
from ...schemas.reports import ReportSummary, CategoryBreakdown, SentimentTrend, TopItem
from ...services.menu_service import _compute_margin, _compute_revenue

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=ReportSummary)
def reports_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.query(MenuItem).filter(MenuItem.user_id == current_user.id).all()
    reviews = db.query(Review).filter(Review.user_id == current_user.id).order_by(Review.created_at).all()

    cat_groups: dict[str, list] = defaultdict(list)
    for item in items:
        cat_groups[item.category].append(item)

    category_breakdown = []
    for cat, cat_items in sorted(cat_groups.items()):
        margins = [_compute_margin(i.price, i.cost) for i in cat_items]
        revenues = [_compute_revenue(i.price, i.orders_last_30_days) for i in cat_items]
        category_breakdown.append(CategoryBreakdown(
            category=cat,
            item_count=len(cat_items),
            avg_price=round(sum(i.price for i in cat_items) / len(cat_items), 2),
            avg_cost=round(sum(i.cost for i in cat_items) / len(cat_items), 2),
            avg_margin=round(sum(margins) / len(margins), 1),
            total_orders=sum(i.orders_last_30_days for i in cat_items),
            total_revenue=round(sum(revenues), 2),
            avg_rating=round(sum(i.rating for i in cat_items) / len(cat_items), 2),
        ))

    month_groups: dict[str, dict] = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})
    for r in reviews:
        key = r.created_at.strftime("%b %Y") if r.created_at else "Unknown"
        month_groups[key][r.sentiment_label] += 1

    sentiment_trend = []
    for month, counts in month_groups.items():
        total = counts["positive"] + counts["neutral"] + counts["negative"]
        sentiment_trend.append(SentimentTrend(
            month=month,
            positive=counts["positive"],
            neutral=counts["neutral"],
            negative=counts["negative"],
            total=total,
        ))

    sorted_by_revenue = sorted(
        items,
        key=lambda i: _compute_revenue(i.price, i.orders_last_30_days),
        reverse=True,
    )
    top_5_by_revenue = [
        TopItem(name=i.name, category=i.category, value=_compute_revenue(i.price, i.orders_last_30_days))
        for i in sorted_by_revenue[:5]
    ]

    sorted_by_margin = sorted(items, key=lambda i: _compute_margin(i.price, i.cost))
    bottom_5_by_margin = [
        TopItem(name=i.name, category=i.category, value=_compute_margin(i.price, i.cost))
        for i in sorted_by_margin[:5]
    ]

    prices = [i.price for i in items] if items else [0]

    return ReportSummary(
        category_breakdown=category_breakdown,
        sentiment_trend=sentiment_trend,
        top_5_by_revenue=top_5_by_revenue,
        bottom_5_by_margin=bottom_5_by_margin,
        total_menu_items=len(items),
        total_reviews=len(reviews),
        price_range_min=round(min(prices), 2),
        price_range_max=round(max(prices), 2),
    )
