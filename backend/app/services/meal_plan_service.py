"""Meal plan generation, shopping list, and daily suggestion engine."""
import random
from datetime import date

from .recipe_service import RECIPES

DIETARY_BLOCKLIST = {
    "vegetarian":  ["beef", "chicken", "pork", "lamb", "duck", "fish", "seafood", "prawn", "bacon", "lardons"],
    "vegan":       ["beef", "chicken", "pork", "lamb", "duck", "fish", "seafood", "prawn", "bacon",
                    "lardons", "egg", "milk", "cheese", "butter", "cream", "feta", "parmesan",
                    "hollandaise", "mascarpone"],
    "keto":        ["rice", "pasta", "bread", "flour", "sugar", "potato", "ladyfinger",
                    "linguine", "arborio", "savoiardi"],
    "gluten_free": ["pasta", "bread", "linguine", "flour", "ladyfinger", "savoiardi", "sourdough",
                    "english muffin"],
    "dairy_free":  ["butter", "cream", "cheese", "milk", "feta", "parmesan", "hollandaise",
                    "mascarpone"],
}

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DAY_VIBES = {
    0: ("cozy",            "Monday comfort — warm yourself up"),
    1: ("light",           "Tuesday light — keep it fresh"),
    2: ("adventurous",     "Wednesday explore — try something new"),
    3: ("quick",           "Thursday quick — short on time tonight"),
    4: ("indulgent",       "Friday treat — you've earned it"),
    5: ("special occasion","Saturday feast — make an occasion of it"),
    6: ("brunch",          "Sunday brunch — slow down and savour"),
}


def _is_compatible(recipe: dict, dietary: str) -> bool:
    if not dietary or dietary not in DIETARY_BLOCKLIST:
        return True
    blocked = DIETARY_BLOCKLIST[dietary]
    text = " ".join(recipe.get("ingredients", [])).lower()
    return not any(b in text for b in blocked)


def _pick(pool: list, used: set, fallback: list) -> dict:
    available = [r for r in pool if r["id"] not in used]
    if not available:
        available = fallback
    choice = random.choice(available)
    used.add(choice["id"])
    return choice


def generate_meal_plan(dietary: str = "", max_cook_minutes: int = 120) -> dict:
    """Return a 7-day meal plan (lunch + dinner) respecting dietary and time constraints."""
    eligible = [r for r in RECIPES
                if r["time_minutes"] <= max_cook_minutes and _is_compatible(r, dietary)]
    if not eligible:
        eligible = RECIPES

    quick  = [r for r in eligible if r["time_minutes"] <= 35] or eligible
    medium = [r for r in eligible if r["time_minutes"] <= 60] or eligible

    random.seed(hash(dietary or "none") % 9999)
    used: set = set()
    plan = []

    for day in DAYS:
        lunch  = _pick(quick,  used.copy(), eligible)
        dinner = _pick(medium, used,        eligible)
        used.add(lunch["id"])
        plan.append({
            "day":    day,
            "lunch":  _recipe_card(lunch),
            "dinner": _recipe_card(dinner),
        })

    return {"dietary": dietary or "any", "max_cook_minutes": max_cook_minutes, "days": plan}


def _recipe_card(r: dict) -> dict:
    return {
        "id":           r["id"],
        "name":         r["title"],
        "cuisine":      r["cuisine"],
        "difficulty":   r["difficulty"],
        "time_minutes": r["time_minutes"],
        "servings":     r["servings"],
        "emoji":        r.get("image_emoji", "🍽️"),
        "description":  r.get("description", ""),
    }


def generate_shopping_list(dietary: str = "") -> dict:
    """Derive a categorised shopping list from the generated meal plan."""
    plan = generate_meal_plan(dietary)
    seen: set = set()
    all_ingredients: list = []

    for day_plan in plan["days"]:
        for meal_type in ("lunch", "dinner"):
            recipe_card = day_plan[meal_type]
            full = next((r for r in RECIPES if r["id"] == recipe_card["id"]), None)
            if not full:
                continue
            for ing in full.get("ingredients", []):
                norm = ing.lower().split(",")[0].strip()
                if norm not in seen:
                    seen.add(norm)
                    all_ingredients.append(ing)

    categories = {
        "🥩 Proteins":      [],
        "🥦 Produce":       [],
        "🧀 Dairy & Eggs":  [],
        "🫙 Pantry":        [],
        "🌿 Herbs & Spices":[],
    }

    protein_kw   = ["beef", "chicken", "lamb", "pork", "duck", "fish", "prawn", "sea bass", "bacon", "tofu", "egg"]
    produce_kw   = ["onion", "garlic", "carrot", "mushroom", "tomato", "pepper", "lemon", "avocado",
                    "aubergine", "green bean", "cherry", "parsley", "basil", "coriander", "mint",
                    "thyme", "chilli", "shallot", "spring onion", "pear", "apple", "pomegranate"]
    dairy_kw     = ["butter", "cream", "cheese", "milk", "mascarpone", "feta", "parmesan", "hollandaise"]
    spice_kw     = ["cumin", "paprika", "chilli flakes", "salt", "cinnamon", "sugar", "harissa",
                    "cayenne", "pepper", "bay leaf", "star anise"]

    for ing in all_ingredients:
        l = ing.lower()
        if any(k in l for k in protein_kw):
            categories["🥩 Proteins"].append(ing)
        elif any(k in l for k in produce_kw):
            categories["🥦 Produce"].append(ing)
        elif any(k in l for k in dairy_kw):
            categories["🧀 Dairy & Eggs"].append(ing)
        elif any(k in l for k in spice_kw):
            categories["🌿 Herbs & Spices"].append(ing)
        else:
            categories["🫙 Pantry"].append(ing)

    return {
        "dietary":     dietary or "any",
        "categories":  {k: v for k, v in categories.items() if v},
        "total_items": len(all_ingredients),
    }


def get_daily_suggestion(mood: str = "") -> dict:
    """Pick the best recipe for today based on the day of the week (or supplied mood)."""
    today           = date.today().weekday()   # 0=Mon … 6=Sun
    vibe, reason    = DAY_VIBES.get(today, ("cozy", "Today's suggestion"))
    target          = mood.lower() if mood else vibe

    scored = sorted(
        RECIPES,
        key=lambda r: (
            2.0 if target in [m.lower() for m in r["mood"]]
            else 0.5
        ),
        reverse=True,
    )

    return {
        "day":         DAYS[today],
        "reason":      reason,
        "mood":        target,
        "suggestion":  scored[0],
        "alternatives": [scored[i] for i in range(1, min(3, len(scored)))],
    }
