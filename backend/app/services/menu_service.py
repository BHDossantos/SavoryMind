from sqlalchemy.orm import Session
from ..models.menu import MenuItem
from ..models.review import Review
from ..schemas.menu import MenuItemCreate, MenuItemUpdate, DashboardStats


def _compute_margin(price: float, cost: float) -> float:
    return round(((price - cost) / price) * 100, 1) if price > 0 else 0.0


def _compute_revenue(price: float, orders: int) -> float:
    return round(price * orders, 2)


def get_all_items(db: Session, category: str | None = None) -> list[MenuItem]:
    q = db.query(MenuItem)
    if category:
        q = q.filter(MenuItem.category == category)
    return q.all()


def get_item(db: Session, item_id: int) -> MenuItem | None:
    return db.query(MenuItem).filter(MenuItem.id == item_id).first()


def create_item(db: Session, item: MenuItemCreate) -> MenuItem:
    db_item = MenuItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_item(db: Session, item_id: int, update: MenuItemUpdate) -> MenuItem | None:
    db_item = get_item(db, item_id)
    if not db_item:
        return None
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(db_item, field, value)
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int) -> bool:
    db_item = get_item(db, item_id)
    if not db_item:
        return False
    db.delete(db_item)
    db.commit()
    return True


def get_dashboard_stats(db: Session) -> DashboardStats:
    items = get_all_items(db)
    if not items:
        return DashboardStats(
            total_menu_items=0,
            total_revenue_30_days=0,
            avg_profit_margin=0,
            avg_rating=0,
            top_performer="N/A",
            total_orders_30_days=0,
        )

    total_revenue = sum(_compute_revenue(i.price, i.orders_last_30_days) for i in items)
    margins = [_compute_margin(i.price, i.cost) for i in items]
    avg_margin = sum(margins) / len(margins)
    avg_rating = sum(i.rating for i in items) / len(items)
    total_orders = sum(i.orders_last_30_days for i in items)
    top = max(items, key=lambda i: i.orders_last_30_days)

    return DashboardStats(
        total_menu_items=len(items),
        total_revenue_30_days=round(total_revenue, 2),
        avg_profit_margin=round(avg_margin, 1),
        avg_rating=round(avg_rating, 2),
        top_performer=top.name,
        total_orders_30_days=total_orders,
    )


def get_recommendations(db: Session) -> list[dict]:
    items = get_all_items(db)
    reviews = db.query(Review).all()

    # Build per-item sentiment map
    item_reviews: dict[str, list] = {}
    for r in reviews:
        item_reviews.setdefault(r.menu_item, []).append(r)

    recommendations = []

    for item in items:
        margin = _compute_margin(item.price, item.cost)
        revenue = _compute_revenue(item.price, item.orders_last_30_days)
        ireviews = item_reviews.get(item.name, [])
        avg_sentiment = (
            sum(r.sentiment_score for r in ireviews) / len(ireviews) if ireviews else None
        )
        neg_ratio = (
            sum(1 for r in ireviews if r.sentiment_label == "negative") / len(ireviews)
            if ireviews else 0
        )

        # Rule 1: High demand, low margin → raise price
        if margin < 30 and item.orders_last_30_days > 50:
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "price_increase",
                "priority": "high",
                "message": f"High demand but low margin ({margin:.0f}%). Consider raising price by 10–15%.",
                "potential_gain": round(item.price * 0.12 * item.orders_last_30_days, 2),
            })

        # Rule 2: High margin, low orders → promote
        if margin > 60 and item.orders_last_30_days < 20:
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "promotion",
                "priority": "medium",
                "message": f"High margin ({margin:.0f}%) but low orders. Run a promotion to boost visibility.",
                "potential_gain": round(item.price * 0.4 * 20, 2),
            })

        # Rule 3: Low star rating → quality review
        if item.rating < 3.5:
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "quality_review",
                "priority": "high",
                "message": f"Low rating ({item.rating:.1f}/5). Review recipe or ingredients.",
                "potential_gain": 0,
            })

        # Rule 4: Star performer
        if revenue > 2000 and margin > 50:
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "star_item",
                "priority": "low",
                "message": f"Star performer! High revenue (${revenue:.0f}) and great margin ({margin:.0f}%). Feature prominently.",
                "potential_gain": round(revenue * 0.1, 2),
            })

        # Rule 5 (new): Negative sentiment despite OK rating
        if avg_sentiment is not None and avg_sentiment < -0.1 and item.rating >= 3.5:
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "quality_review",
                "priority": "medium",
                "message": f"Recent reviews trend negative (avg sentiment {avg_sentiment:.2f}) despite a decent star rating. Investigate recent complaints.",
                "potential_gain": 0,
            })

        # Rule 6 (new): High negative review ratio
        if neg_ratio > 0.4 and len(ireviews) >= 3:
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "quality_review",
                "priority": "high",
                "message": f"{neg_ratio:.0%} of reviews are negative. Immediate attention needed.",
                "potential_gain": 0,
            })

        # Rule 7 (new): Customers love it but it's underpriced
        if (
            avg_sentiment is not None
            and avg_sentiment > 0.5
            and margin < 40
            and item.orders_last_30_days > 30
        ):
            recommendations.append({
                "item": item.name,
                "category": item.category,
                "type": "price_increase",
                "priority": "medium",
                "message": f"Customers love this item (sentiment {avg_sentiment:.2f}) and demand is solid. You have room to raise the price.",
                "potential_gain": round(item.price * 0.10 * item.orders_last_30_days, 2),
            })

    recommendations.sort(key=lambda r: {"high": 0, "medium": 1, "low": 2}[r["priority"]])
    return recommendations
