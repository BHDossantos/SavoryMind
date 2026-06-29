"""
Delivery service — maps recipe knowledge base to orderable dishes
and provides a curated nearby-restaurant catalog per cuisine.
"""
import random
from .recipe_service import get_recipe_recommendations

# Craving → mood/keyword/time mappings
CRAVING_MAP = {
    "rich_warm":   {"mood": "cozy",        "keywords": "stew braise hearty bowl",   "max_time": 0},
    "light_fresh": {"mood": "healthy",     "keywords": "salad poke bowl fresh",      "max_time": 40},
    "spicy_bold":  {"mood": "adventurous", "keywords": "curry spicy bold thai korean","max_time": 0},
    "comfort":     {"mood": "indulgent",   "keywords": "pizza pasta burger comfort", "max_time": 0},
    "fast_easy":   {"mood": "quick",       "keywords": "quick wrap bowl fast",       "max_time": 25},
    "sweet_treat": {"mood": "brunch",      "keywords": "dessert sweet cake pastry",  "max_time": 30},
}

# Base delivery prices by difficulty
PRICE_BY_DIFFICULTY = {"Easy": 13, "Medium": 18, "Hard": 24}

# Curated restaurant catalog — indexed by cuisine keyword
RESTAURANT_CATALOG = {
    "Italian":     [
        {"name": "Osteria Della Nonna", "emoji": "🫕", "rating": 4.8, "reviews": 312, "dist_km": 1.1, "eta_min": (20, 30), "fee": 0.00},
        {"name": "La Trattoria",        "emoji": "🍝", "rating": 4.6, "reviews": 198, "dist_km": 2.3, "eta_min": (30, 45), "fee": 1.99},
        {"name": "Pizza Romana",        "emoji": "🍕", "rating": 4.7, "reviews": 445, "dist_km": 0.8, "eta_min": (15, 25), "fee": 0.00},
    ],
    "Thai":        [
        {"name": "Bangkok Street Kitchen","emoji": "🌶️","rating": 4.9, "reviews": 521, "dist_km": 0.9, "eta_min": (20, 30), "fee": 0.00},
        {"name": "Pad & Wok",           "emoji": "🍜", "rating": 4.6, "reviews": 287, "dist_km": 1.8, "eta_min": (25, 40), "fee": 1.49},
        {"name": "Lotus Thai",          "emoji": "🪷", "rating": 4.7, "reviews": 364, "dist_km": 2.5, "eta_min": (30, 45), "fee": 0.00},
    ],
    "Japanese":    [
        {"name": "Sakura Omakase",      "emoji": "🌸", "rating": 4.9, "reviews": 189, "dist_km": 1.4, "eta_min": (20, 35), "fee": 0.00},
        {"name": "Nori & Co",           "emoji": "🍣", "rating": 4.7, "reviews": 403, "dist_km": 0.7, "eta_min": (15, 25), "fee": 0.00},
        {"name": "Ramen Tora",          "emoji": "🍜", "rating": 4.8, "reviews": 612, "dist_km": 1.9, "eta_min": (25, 35), "fee": 1.99},
    ],
    "Indian":      [
        {"name": "Spice Garden",        "emoji": "🫙", "rating": 4.8, "reviews": 478, "dist_km": 1.2, "eta_min": (25, 40), "fee": 0.00},
        {"name": "Curry House",         "emoji": "🍛", "rating": 4.6, "reviews": 334, "dist_km": 2.0, "eta_min": (30, 45), "fee": 1.49},
        {"name": "Tandoor Palace",      "emoji": "🔥", "rating": 4.7, "reviews": 289, "dist_km": 3.1, "eta_min": (35, 50), "fee": 0.00},
    ],
    "French":      [
        {"name": "Café de Paris",       "emoji": "🥐", "rating": 4.8, "reviews": 156, "dist_km": 1.6, "eta_min": (25, 40), "fee": 0.00},
        {"name": "Le Bistro",           "emoji": "🍷", "rating": 4.7, "reviews": 241, "dist_km": 2.2, "eta_min": (30, 45), "fee": 1.99},
        {"name": "Brasserie Moderne",   "emoji": "🫖", "rating": 4.6, "reviews": 198, "dist_km": 0.9, "eta_min": (20, 30), "fee": 0.00},
    ],
    "Mexican":     [
        {"name": "El Taquero",          "emoji": "🌮", "rating": 4.9, "reviews": 678, "dist_km": 0.6, "eta_min": (15, 25), "fee": 0.00},
        {"name": "Casa Jalisco",        "emoji": "🪅", "rating": 4.7, "reviews": 389, "dist_km": 1.7, "eta_min": (25, 35), "fee": 1.49},
        {"name": "Guacamole Bar",       "emoji": "🥑", "rating": 4.6, "reviews": 251, "dist_km": 2.4, "eta_min": (30, 45), "fee": 0.00},
    ],
    "Korean":      [
        {"name": "Seoul Kitchen",       "emoji": "🫕", "rating": 4.8, "reviews": 342, "dist_km": 1.3, "eta_min": (20, 35), "fee": 0.00},
        {"name": "K-BBQ House",         "emoji": "🥩", "rating": 4.9, "reviews": 567, "dist_km": 0.8, "eta_min": (20, 30), "fee": 1.49},
        {"name": "Bibimbap Bros",       "emoji": "🍚", "rating": 4.7, "reviews": 288, "dist_km": 2.1, "eta_min": (25, 40), "fee": 0.00},
    ],
    "American":    [
        {"name": "The Smash Co.",       "emoji": "🍔", "rating": 4.8, "reviews": 892, "dist_km": 0.5, "eta_min": (15, 25), "fee": 0.00},
        {"name": "Comfort & Co",        "emoji": "🧀", "rating": 4.6, "reviews": 445, "dist_km": 1.4, "eta_min": (20, 30), "fee": 1.49},
        {"name": "The Grill Room",      "emoji": "🔥", "rating": 4.7, "reviews": 321, "dist_km": 2.8, "eta_min": (30, 45), "fee": 0.00},
    ],
    "default":     [
        {"name": "The Kitchen Table",   "emoji": "🍽️", "rating": 4.7, "reviews": 412, "dist_km": 1.0, "eta_min": (20, 35), "fee": 0.00},
        {"name": "Nouri Kitchen",       "emoji": "🌿", "rating": 4.8, "reviews": 278, "dist_km": 1.5, "eta_min": (25, 40), "fee": 1.49},
        {"name": "The Fork & Co.",      "emoji": "🍴", "rating": 4.6, "reviews": 334, "dist_km": 2.2, "eta_min": (30, 45), "fee": 0.00},
    ],
}


def _price_for_recipe(recipe: dict) -> float:
    base = PRICE_BY_DIFFICULTY.get(recipe.get("difficulty", "Medium"), 18)
    # Add slight variation per recipe id so prices differ
    offset = (recipe.get("id", 0) % 5) - 2  # -2 to +2
    return round(base + offset, 2)


def get_dishes_for_craving(craving_id: str, budget: str = "") -> list[dict]:
    """Return ordered dishes for a given craving using the recipe engine."""
    mapping = CRAVING_MAP.get(craving_id, {"mood": craving_id, "keywords": "", "max_time": 0})
    result = get_recipe_recommendations(
        mood=mapping["mood"],
        keywords=mapping["keywords"],
        max_time=mapping["max_time"],
        n=6,
    )
    dishes = []
    for r in result.get("recipes", []):
        price = _price_for_recipe(r)
        # Budget filter (soft — just sorts/excludes extremes)
        if budget == "budget" and price > 17:
            continue
        if budget == "treat" and price < 17:
            continue
        dishes.append({
            "id":      r["id"],
            "name":    r["title"],
            "emoji":   r.get("image_emoji", "🍽️"),
            "cuisine": r.get("cuisine", ""),
            "time":    f"{r.get('time_minutes', 30)} min",
            "price":   f"${price:.0f}",
            "price_val": price,
            "rating":  round(4.4 + (r.get("id", 0) % 6) * 0.1, 1),  # 4.4–4.9
            "difficulty": r.get("difficulty", "Medium"),
            "tags":    r.get("mood", [])[:2],
        })
    # Fallback: if budget filter stripped everything, return unfiltered
    if not dishes:
        return get_dishes_for_craving(craving_id, "")
    return dishes[:6]


def get_restaurants_for_cuisine(cuisine: str) -> list[dict]:
    """Return 3 restaurants that serve the given cuisine, ranked by rating."""
    # Find best catalog match
    catalog = None
    for key in RESTAURANT_CATALOG:
        if key.lower() in cuisine.lower() or cuisine.lower() in key.lower():
            catalog = RESTAURANT_CATALOG[key]
            break
    if not catalog:
        catalog = RESTAURANT_CATALOG["default"]

    result = []
    for i, r in enumerate(catalog):
        lo, hi = r["eta_min"]
        result.append({
            "id":       f"rest-{i}",
            "name":     r["name"],
            "emoji":    r["emoji"],
            "rating":   r["rating"],
            "reviews":  r["reviews"],
            "dist_km":  r["dist_km"],
            "eta":      f"{lo}–{hi} min",
            "fee":      "Free delivery" if r["fee"] == 0 else f"${r['fee']:.2f} delivery",
            "fee_val":  r["fee"],
            "best_match": i == 0,
        })
    return sorted(result, key=lambda x: (-x["rating"], x["fee_val"]))
