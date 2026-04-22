from datetime import date, timedelta
from sqlalchemy.orm import Session
from ..models.menu import MenuItem
from ..models.review import Review
from ..models.consumer import WinePairing, MusicMood, SocialConnection
from ..models.restaurant_ext import Booking, CRMCustomer, Staff
from ..models.kitchen import FoodWasteLog, DishTimeLog
from .sentiment_service import analyze_sentiment
import json

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


def seed_database(db: Session, user_id: int) -> None:
    if db.query(MenuItem).filter(MenuItem.user_id == user_id).count() > 0:
        return

    for item_data in MENU_ITEMS:
        db.add(MenuItem(**item_data, user_id=user_id))
    db.commit()

    for review_data in REVIEWS:
        score, label = analyze_sentiment(review_data["comment"])
        db.add(Review(**review_data, user_id=user_id, sentiment_score=score, sentiment_label=label))
    db.commit()

    _seed_bookings(db, user_id)
    _seed_crm(db, user_id)
    _seed_staff(db, user_id)
    _seed_waste(db, user_id)
    _seed_kitchen_times(db, user_id)


def _seed_bookings(db: Session, user_id: int) -> None:
    today = date.today()
    bookings = [
        {"customer_name": "Sophie Laurent", "customer_email": "sophie@email.com", "customer_phone": "+44 7700 900111", "date": today, "time_slot": "12:30", "party_size": 2, "table_number": 4, "status": "confirmed", "notes": "Anniversary — bring dessert card"},
        {"customer_name": "James Thornton", "customer_email": "jt@corp.com", "customer_phone": "+44 7700 900222", "date": today, "time_slot": "13:00", "party_size": 6, "table_number": 8, "status": "confirmed", "notes": "Business lunch"},
        {"customer_name": "Maria Santos", "customer_phone": "+44 7700 900333", "date": today, "time_slot": "19:00", "party_size": 4, "table_number": 12, "status": "confirmed", "notes": ""},
        {"customer_name": "David Kim", "customer_email": "david@kim.com", "date": today, "time_slot": "20:00", "party_size": 2, "table_number": 3, "status": "confirmed", "notes": "Peanut allergy!"},
        {"customer_name": "Emma Williams", "date": today + timedelta(days=1), "time_slot": "19:30", "party_size": 8, "table_number": 15, "status": "confirmed", "notes": "Birthday party"},
        {"customer_name": "Luca Ferrari", "date": today + timedelta(days=1), "time_slot": "20:30", "party_size": 3, "table_number": 6, "status": "confirmed"},
        {"customer_name": "Chen Wei", "date": today + timedelta(days=2), "time_slot": "12:00", "party_size": 2, "table_number": 2, "status": "confirmed"},
        {"customer_name": "Aisha Patel", "date": today - timedelta(days=1), "time_slot": "19:00", "party_size": 4, "table_number": 10, "status": "completed"},
        {"customer_name": "Robert Hughes", "date": today - timedelta(days=2), "time_slot": "20:00", "party_size": 2, "table_number": 5, "status": "cancelled", "notes": "No show"},
    ]
    for b in bookings:
        db.add(Booking(**b, user_id=user_id))
    db.commit()


def _seed_crm(db: Session, user_id: int) -> None:
    today = date.today()
    customers = [
        {"name": "Sophie Laurent", "email": "sophie@email.com", "phone": "+44 7700 900111", "total_visits": 18, "total_spend": 1240.50, "last_visit": today, "favorite_items": "Grilled Salmon, Tiramisu", "tags": "vip,regular", "notes": "Prefers table by window"},
        {"name": "James Thornton", "email": "jt@corp.com", "phone": "+44 7700 900222", "total_visits": 12, "total_spend": 2890.00, "last_visit": today, "favorite_items": "Beef Burger, House Wine", "tags": "vip,corporate", "notes": "Expense account — always books for 4–8"},
        {"name": "Maria Santos", "phone": "+44 7700 900333", "total_visits": 7, "total_spend": 420.00, "last_visit": today - timedelta(days=14), "favorite_items": "Caesar Salad, Craft Lemonade", "tags": "regular"},
        {"name": "David Kim", "email": "david@kim.com", "total_visits": 5, "total_spend": 310.00, "last_visit": today, "favorite_items": "Margherita Pizza", "tags": "regular", "notes": "Severe peanut allergy — flag kitchen"},
        {"name": "Emma Williams", "total_visits": 3, "total_spend": 185.00, "last_visit": today - timedelta(days=30), "tags": "birthday"},
        {"name": "Aisha Patel", "email": "aisha@email.com", "total_visits": 9, "total_spend": 560.00, "last_visit": today - timedelta(days=1), "favorite_items": "Truffle Pasta, Lobster Bisque", "tags": "vip,foodie"},
        {"name": "Robert Hughes", "total_visits": 1, "total_spend": 0, "last_visit": today - timedelta(days=2), "tags": "no-show", "notes": "Did not honour booking"},
        {"name": "Luca Ferrari", "email": "luca@ferrari.it", "total_visits": 14, "total_spend": 1100.00, "last_visit": today - timedelta(days=7), "favorite_items": "Fish & Chips, House Wine", "tags": "regular"},
    ]
    for c in customers:
        db.add(CRMCustomer(**c, user_id=user_id))
    db.commit()


def _seed_staff(db: Session, user_id: int) -> None:
    staff = [
        {"name": "Marco Rivera", "role": "chef", "shift": "full", "hire_date": date(2021, 3, 15), "rating": 4.8, "orders_handled": 3200, "avg_order_value": 22.50, "punctuality_score": 97.0, "notes": "Head chef, specialises in Italian"},
        {"name": "Priya Nair", "role": "server", "shift": "evening", "hire_date": date(2022, 6, 1), "rating": 4.9, "orders_handled": 1800, "avg_order_value": 28.00, "punctuality_score": 99.0, "notes": "Top seller — always upsells wine"},
        {"name": "Tom Bradley", "role": "bartender", "shift": "evening", "hire_date": date(2020, 9, 10), "rating": 4.5, "orders_handled": 2100, "avg_order_value": 12.00, "punctuality_score": 91.0},
        {"name": "Sara Okonkwo", "role": "server", "shift": "afternoon", "hire_date": date(2023, 1, 20), "rating": 4.3, "orders_handled": 900, "avg_order_value": 24.00, "punctuality_score": 88.0, "notes": "Still learning wine pairing"},
        {"name": "Li Wei", "role": "host", "shift": "full", "hire_date": date(2022, 4, 5), "rating": 4.6, "orders_handled": 0, "avg_order_value": 0, "punctuality_score": 95.0, "notes": "Manages reservations and front of house"},
        {"name": "Carlos Mendes", "role": "chef", "shift": "morning", "hire_date": date(2023, 7, 12), "rating": 3.8, "orders_handled": 650, "avg_order_value": 18.00, "punctuality_score": 82.0, "notes": "Shows promise — needs mentoring on plating"},
    ]
    for s in staff:
        db.add(Staff(**s, user_id=user_id))
    db.commit()


def seed_consumer_data(db: Session, user_id: int) -> None:
    """Seed starter data for a new consumer account."""
    from .wine_service import pair_wine
    from .music_service import build_music_recommendation

    # Seed example wine pairings
    pairings = [
        ("Grilled Salmon with Lemon Butter", "Atlantic salmon fillet, butter sauce, capers"),
        ("Beef Steak", "8oz ribeye, medium-rare, with roasted garlic"),
        ("Truffle Pasta", "Tagliatelle with black truffle shavings and parmesan"),
    ]
    for dish_name, desc in pairings:
        recs = pair_wine(dish_name, desc)
        db.add(WinePairing(user_id=user_id, dish_name=dish_name, dish_description=desc, recommendations=json.dumps(recs)))

    # Seed example music moods
    moods = [
        ("romantic", "light", "date_night"),
        ("celebratory", "rich", "dinner_party"),
        ("casual", "neutral", "solo"),
    ]
    for mood, food_type, occasion in moods:
        recs = build_music_recommendation(mood, food_type, occasion)
        db.add(MusicMood(user_id=user_id, mood=mood, food_type=food_type, occasion=occasion, recommendations=json.dumps(recs)))

    # Seed social connections (all disconnected)
    platforms = ["spotify", "amazon_music", "alexa", "instagram", "tiktok"]
    for platform in platforms:
        db.add(SocialConnection(user_id=user_id, platform=platform, connected=False))

    db.commit()


def seed_diner_data(db, user_id: int):
    """Seed example diner data so new accounts have something to explore."""
    import datetime
    from ..models.diner import DinerBooking, DinerVisit

    # Sample past visits
    visits = [
        {
            "restaurant_name": "The Blue Plate",
            "visit_date": str(datetime.date.today() - datetime.timedelta(days=14)),
            "items_ordered": "Beef Tenderloin, Truffle Risotto, Crème Brûlée",
            "overall_rating": 4.8,
            "food_rating": 5.0,
            "staff_rating": 4.5,
            "would_return": True,
            "highlights": "The truffle risotto was outstanding. Excellent wine list.",
            "lowlights": "Slightly long wait for dessert.",
            "notes": "Perfect anniversary dinner spot.",
        },
        {
            "restaurant_name": "Sakura Garden",
            "visit_date": str(datetime.date.today() - datetime.timedelta(days=7)),
            "items_ordered": "Dragon Roll, Salmon Sashimi, Miso Ramen",
            "overall_rating": 4.2,
            "food_rating": 4.5,
            "staff_rating": 4.0,
            "would_return": True,
            "highlights": "Freshest sashimi in the city.",
            "lowlights": "Noisy on Friday nights.",
            "notes": "Great for sushi but book ahead.",
        },
        {
            "restaurant_name": "Casa Italiana",
            "visit_date": str(datetime.date.today() - datetime.timedelta(days=3)),
            "items_ordered": "Burrata, Lobster Linguine, Tiramisu",
            "overall_rating": 4.6,
            "food_rating": 4.8,
            "staff_rating": 4.5,
            "would_return": True,
            "highlights": "Burrata was the best I've ever had. Staff were incredibly attentive.",
            "lowlights": "",
            "notes": "Would recommend for a special occasion.",
        },
    ]
    for v in visits:
        db.add(DinerVisit(user_id=user_id, **v))

    # Upcoming booking
    upcoming = str(datetime.date.today() + datetime.timedelta(days=10))
    db.add(DinerBooking(
        user_id=user_id,
        restaurant_name="The Blue Plate",
        booking_date=upcoming,
        booking_time="19:30",
        party_size=2,
        special_requests="Window table if available. Celebrating a birthday.",
        status="confirmed",
    ))

    db.commit()


def _seed_waste(db: Session, user_id: int) -> None:
    today = date.today()
    entries = [
        {"item_name": "Beef Tenderloin", "staff_name": "Carlos Mendes", "quantity_kg": 0.8, "estimated_cost": 24.00, "reason": "Over-portioned", "date": today - timedelta(days=1), "notes": ""},
        {"item_name": "Truffle Pasta", "staff_name": "Carlos Mendes", "quantity_kg": 0.3, "estimated_cost": 8.50, "reason": "Cooking error", "date": today - timedelta(days=2), "notes": "Overcooked"},
        {"item_name": "Grilled Salmon", "staff_name": "Marco Rivera", "quantity_kg": 0.2, "estimated_cost": 6.00, "reason": "Spoilage", "date": today - timedelta(days=3), "notes": ""},
        {"item_name": "Cheese Board", "staff_name": "Sara Okonkwo", "quantity_kg": 0.5, "estimated_cost": 12.00, "reason": "Over-ordered", "date": today - timedelta(days=4), "notes": ""},
        {"item_name": "Beef Tenderloin", "staff_name": "Carlos Mendes", "quantity_kg": 0.6, "estimated_cost": 18.00, "reason": "Over-portioned", "date": today - timedelta(days=5), "notes": ""},
        {"item_name": "Lobster Bisque", "staff_name": "Marco Rivera", "quantity_kg": 0.4, "estimated_cost": 14.00, "reason": "Cooking error", "date": today - timedelta(days=6), "notes": "Too salty"},
        {"item_name": "Crème Brûlée", "staff_name": "Sara Okonkwo", "quantity_kg": 0.2, "estimated_cost": 4.00, "reason": "Dropped", "date": today - timedelta(days=7), "notes": ""},
    ]
    for e in entries:
        db.add(FoodWasteLog(user_id=user_id, **e))
    db.commit()


def _seed_kitchen_times(db: Session, user_id: int) -> None:
    today = date.today()
    entries = [
        {"item_name": "Beef Tenderloin", "staff_name": "Marco Rivera", "prep_minutes": 8, "cook_minutes": 12, "date": today - timedelta(days=1)},
        {"item_name": "Beef Tenderloin", "staff_name": "Carlos Mendes", "prep_minutes": 14, "cook_minutes": 18, "date": today - timedelta(days=1)},
        {"item_name": "Truffle Pasta", "staff_name": "Marco Rivera", "prep_minutes": 5, "cook_minutes": 15, "date": today - timedelta(days=2)},
        {"item_name": "Truffle Pasta", "staff_name": "Carlos Mendes", "prep_minutes": 8, "cook_minutes": 22, "date": today - timedelta(days=2)},
        {"item_name": "Grilled Salmon", "staff_name": "Marco Rivera", "prep_minutes": 6, "cook_minutes": 10, "date": today - timedelta(days=3)},
        {"item_name": "Grilled Salmon", "staff_name": "Sara Okonkwo", "prep_minutes": 7, "cook_minutes": 11, "date": today - timedelta(days=3)},
        {"item_name": "Margherita Pizza", "staff_name": "Carlos Mendes", "prep_minutes": 10, "cook_minutes": 14, "date": today - timedelta(days=4)},
        {"item_name": "Margherita Pizza", "staff_name": "Marco Rivera", "prep_minutes": 6, "cook_minutes": 9, "date": today - timedelta(days=4)},
        {"item_name": "Caesar Salad", "staff_name": "Priya Nair", "prep_minutes": 4, "cook_minutes": 2, "date": today - timedelta(days=5)},
    ]
    for e in entries:
        db.add(DishTimeLog(user_id=user_id, **e))
    db.commit()
