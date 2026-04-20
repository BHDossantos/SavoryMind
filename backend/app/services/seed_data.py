from sqlalchemy.orm import Session
from ..models.menu import MenuItem
from ..models.review import Review
from .sentiment_service import analyze_sentiment

MENU_ITEMS = [
    # Star items: high revenue + good margin
    {"name": "Grilled Salmon", "category": "Mains", "price": 28.00, "cost": 9.50, "orders_last_30_days": 145, "rating": 4.7, "description": "Atlantic salmon with lemon butter"},
    {"name": "Caesar Salad", "category": "Starters", "price": 12.00, "cost": 3.50, "orders_last_30_days": 210, "rating": 4.3, "description": "Classic romaine with house-made dressing"},
    {"name": "Tiramisu", "category": "Desserts", "price": 9.00, "cost": 2.20, "orders_last_30_days": 121, "rating": 4.9, "description": "Classic Italian with mascarpone"},
    {"name": "Margherita Pizza", "category": "Mains", "price": 16.00, "cost": 4.50, "orders_last_30_days": 162, "rating": 4.4, "description": "Wood-fired with San Marzano tomatoes"},
    # Price increase needed: high demand, low margin
    {"name": "Beef Burger", "category": "Mains", "price": 18.00, "cost": 13.50, "orders_last_30_days": 187, "rating": 4.6, "description": "8oz wagyu patty with aged cheddar"},
    {"name": "Fish & Chips", "category": "Mains", "price": 15.00, "cost": 11.00, "orders_last_30_days": 95, "rating": 4.2, "description": "Beer-battered cod with hand-cut chips"},
    # Promotion needed: great margin, low orders
    {"name": "Lobster Bisque", "category": "Starters", "price": 15.00, "cost": 3.50, "orders_last_30_days": 12, "rating": 4.8, "description": "Creamy bisque with claw meat"},
    {"name": "Truffle Pasta", "category": "Mains", "price": 22.00, "cost": 5.00, "orders_last_30_days": 15, "rating": 4.5, "description": "Tagliatelle with black truffle and parmesan"},
    # Quality review: low rating
    {"name": "Mushroom Risotto", "category": "Mains", "price": 20.00, "cost": 5.50, "orders_last_30_days": 43, "rating": 2.9, "description": "Arborio rice with wild mushrooms"},
    {"name": "Cheese Board", "category": "Starters", "price": 18.00, "cost": 9.00, "orders_last_30_days": 28, "rating": 3.1, "description": "Selection of artisan cheeses"},
    # Normal items
    {"name": "Chocolate Lava Cake", "category": "Desserts", "price": 10.00, "cost": 2.50, "orders_last_30_days": 89, "rating": 4.8, "description": "Warm with vanilla ice cream"},
    {"name": "Craft Lemonade", "category": "Drinks", "price": 5.00, "cost": 0.80, "orders_last_30_days": 290, "rating": 4.2, "description": "Fresh-squeezed with mint"},
    {"name": "House Wine (Glass)", "category": "Drinks", "price": 8.00, "cost": 2.00, "orders_last_30_days": 175, "rating": 4.0, "description": "Rotating selection of reds and whites"},
]

REVIEWS = [
    {"customer_name": "Alice M.", "menu_item": "Grilled Salmon", "rating": 5, "comment": "Absolutely fantastic! The salmon was perfectly cooked and the lemon butter was divine."},
    {"customer_name": "Bob K.", "menu_item": "Beef Burger", "rating": 4, "comment": "Great burger, juicy and flavorful. Would have liked more sauce options."},
    {"customer_name": "Carol T.", "menu_item": "Caesar Salad", "rating": 4, "comment": "Fresh and crispy. The dressing was excellent, not too heavy."},
    {"customer_name": "David L.", "menu_item": "Truffle Pasta", "rating": 5, "comment": "Incredible flavor! The truffle aroma was amazing. Best pasta I've had in years."},
    {"customer_name": "Emma R.", "menu_item": "Cheese Board", "rating": 3, "comment": "Selection was decent but not very exciting. The crackers were stale unfortunately."},
    {"customer_name": "Frank W.", "menu_item": "Tiramisu", "rating": 5, "comment": "Best tiramisu ever! Light, creamy and perfectly balanced. Will order again."},
    {"customer_name": "Grace H.", "menu_item": "Mushroom Risotto", "rating": 3, "comment": "Risotto was okay but a bit bland. Could use more seasoning and cheese."},
    {"customer_name": "Henry S.", "menu_item": "Margherita Pizza", "rating": 5, "comment": "Wood-fired perfection. The crust was crispy and the tomatoes were sweet and fresh."},
    {"customer_name": "Irene P.", "menu_item": "Lobster Bisque", "rating": 5, "comment": "Rich, creamy and full of lobster. Absolutely worth the price. Outstanding dish!"},
    {"customer_name": "James O.", "menu_item": "Craft Lemonade", "rating": 4, "comment": "Refreshing and not too sweet. The mint was a nice touch."},
    {"customer_name": "Kate N.", "menu_item": "Chocolate Lava Cake", "rating": 5, "comment": "Perfectly gooey center! The ice cream pairing was perfect. Amazing dessert!"},
    {"customer_name": "Liam C.", "menu_item": "Beef Burger", "rating": 2, "comment": "Disappointing. The patty was overcooked and dry. Not what I expected for the price."},
    {"customer_name": "Mia F.", "menu_item": "Caesar Salad", "rating": 5, "comment": "Love this salad! Huge portion and the croutons were homemade. Delicious!"},
    {"customer_name": "Noah B.", "menu_item": "House Wine (Glass)", "rating": 4, "comment": "Good selection. The red was smooth and well-priced for the quality."},
    {"customer_name": "Olivia D.", "menu_item": "Grilled Salmon", "rating": 4, "comment": "Very good salmon. Cooked perfectly medium. The sides could be more generous."},
]


def seed_database(db: Session) -> None:
    if db.query(MenuItem).count() > 0:
        return

    for item_data in MENU_ITEMS:
        db.add(MenuItem(**item_data))
    db.commit()

    for review_data in REVIEWS:
        score, label = analyze_sentiment(review_data["comment"])
        db.add(Review(**review_data, sentiment_score=score, sentiment_label=label))
    db.commit()
