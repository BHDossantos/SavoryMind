"""Restaurant discovery engine and full experience planner for diners."""
import random

RESTAURANTS = [
    {
        "id": 1,
        "name": "Maison Aurore",
        "cuisine": "French",
        "vibe": ["romantic", "special occasion", "date night", "intimate"],
        "price_level": 4,
        "price_label": "$$$$",
        "rating": 4.8,
        "reviews": 312,
        "distance_km": 1.2,
        "standout_dish": "Duck Confit with Cherry Jus",
        "description": "Candlelit French bistro with white tablecloths, tasting menus, and an exceptional wine cellar.",
        "tags": ["wine list", "tasting menu", "sommelier", "reservations required"],
        "open_now": True,
        "wait_minutes": 0,
        "emoji": "🥂",
        "music_match": "Jazz",
        "wine_match": "Burgundy Pinot Noir",
    },
    {
        "id": 2,
        "name": "Wok & Wonder",
        "cuisine": "Asian Fusion",
        "vibe": ["adventurous", "group", "fun", "energetic", "casual"],
        "price_level": 2,
        "price_label": "$$",
        "rating": 4.5,
        "reviews": 1204,
        "distance_km": 0.6,
        "standout_dish": "Szechuan Crispy Beef Bowl",
        "description": "Bold Asian flavours in a buzzy open kitchen. Great for sharing plates and group nights out.",
        "tags": ["sharing plates", "group-friendly", "no reservations", "BYOB"],
        "open_now": True,
        "wait_minutes": 15,
        "emoji": "🍜",
        "music_match": "Hip-Hop / RnB",
        "wine_match": "Off-dry Riesling",
    },
    {
        "id": 3,
        "name": "The Garden Table",
        "cuisine": "Vegetarian / Vegan",
        "vibe": ["healthy", "light", "relaxed", "mindful", "brunch"],
        "price_level": 2,
        "price_label": "$$",
        "rating": 4.6,
        "reviews": 890,
        "distance_km": 0.9,
        "standout_dish": "Roasted Beetroot & Quinoa Bowl",
        "description": "An airy plant-based café with seasonal menus, cold-pressed juices, and a weekend brunch that books out.",
        "tags": ["vegan", "gluten-free options", "brunch", "outdoor seating"],
        "open_now": True,
        "wait_minutes": 5,
        "emoji": "🥗",
        "music_match": "Acoustic / Lo-fi",
        "wine_match": "Organic Sauvignon Blanc",
    },
    {
        "id": 4,
        "name": "Grill & Co.",
        "cuisine": "American",
        "vibe": ["casual", "comfort", "group", "family", "sport"],
        "price_level": 2,
        "price_label": "$$",
        "rating": 4.3,
        "reviews": 2100,
        "distance_km": 0.4,
        "standout_dish": "Smoked Brisket Burger",
        "description": "No-frills, all-flavour. The best burgers and ribs in the neighbourhood with craft beers on tap.",
        "tags": ["craft beer", "burgers", "ribs", "family-friendly"],
        "open_now": True,
        "wait_minutes": 20,
        "emoji": "🍔",
        "music_match": "Classic Rock",
        "wine_match": "American Pale Ale",
    },
    {
        "id": 5,
        "name": "Sakura House",
        "cuisine": "Japanese",
        "vibe": ["romantic", "relaxed", "quiet", "date night", "mindful"],
        "price_level": 3,
        "price_label": "$$$",
        "rating": 4.7,
        "reviews": 654,
        "distance_km": 1.8,
        "standout_dish": "Omakase Sushi Selection",
        "description": "Serene Japanese dining with an omakase counter, premium sake selection, and minimalist design.",
        "tags": ["sake", "sushi", "omakase", "quiet", "reservations recommended"],
        "open_now": True,
        "wait_minutes": 0,
        "emoji": "🍱",
        "music_match": "Ambient / Japanese",
        "wine_match": "Junmai Daiginjo Sake",
    },
    {
        "id": 6,
        "name": "La Piazza",
        "cuisine": "Italian",
        "vibe": ["family", "casual", "comfort", "group", "cozy"],
        "price_level": 2,
        "price_label": "$$",
        "rating": 4.4,
        "reviews": 1567,
        "distance_km": 0.7,
        "standout_dish": "Truffle Pappardelle",
        "description": "Generous portions of handmade pasta and wood-fired pizza in a warm, noisy room that feels like someone's home.",
        "tags": ["pasta", "pizza", "family-friendly", "walk-ins welcome", "BYOB"],
        "open_now": True,
        "wait_minutes": 25,
        "emoji": "🍝",
        "music_match": "Italian Jazz / Pop",
        "wine_match": "Chianti Classico",
    },
    {
        "id": 7,
        "name": "Spice Route",
        "cuisine": "Indian",
        "vibe": ["adventurous", "spicy", "group", "bold", "celebratory"],
        "price_level": 2,
        "price_label": "$$",
        "rating": 4.5,
        "reviews": 978,
        "distance_km": 1.1,
        "standout_dish": "Lamb Rogan Josh Tasting Plate",
        "description": "A vibrant journey through India's regional cuisines — from delicate Keralan seafood to fierce Rajasthani lamb.",
        "tags": ["sharing plates", "spicy options", "vegetarian menu", "cocktails"],
        "open_now": True,
        "wait_minutes": 10,
        "emoji": "🍛",
        "music_match": "Bollywood / World",
        "wine_match": "Gewürztraminer",
    },
    {
        "id": 8,
        "name": "The Rooftop Terrace",
        "cuisine": "Mediterranean",
        "vibe": ["celebratory", "views", "fun", "social", "summer", "group"],
        "price_level": 3,
        "price_label": "$$$",
        "rating": 4.6,
        "reviews": 445,
        "distance_km": 2.3,
        "standout_dish": "Whole Grilled Branzino",
        "description": "Sunset views, tapas-style Mediterranean sharing plates, and a cocktail list that rivals the skyline.",
        "tags": ["rooftop", "cocktails", "views", "tapas", "outdoor"],
        "open_now": True,
        "wait_minutes": 30,
        "emoji": "🌅",
        "music_match": "Lounge / Deep House",
        "wine_match": "Albariño or Rosé",
    },
    {
        "id": 9,
        "name": "Corner Brasserie",
        "cuisine": "Modern European",
        "vibe": ["casual", "relaxed", "solo", "work lunch", "quick"],
        "price_level": 2,
        "price_label": "$$",
        "rating": 4.2,
        "reviews": 2344,
        "distance_km": 0.3,
        "standout_dish": "Croque Monsieur with Dressed Salad",
        "description": "Your reliable neighbourhood spot. Great coffee, approachable menu, and a terrace for sunny lunches.",
        "tags": ["breakfast", "brunch", "lunch", "coffee", "walk-ins"],
        "open_now": True,
        "wait_minutes": 5,
        "emoji": "☕",
        "music_match": "Café Indie",
        "wine_match": "House Côtes du Rhône",
    },
    {
        "id": 10,
        "name": "Asador Brasas",
        "cuisine": "Spanish",
        "vibe": ["social", "celebratory", "group", "wine", "special occasion"],
        "price_level": 3,
        "price_label": "$$$",
        "rating": 4.7,
        "reviews": 721,
        "distance_km": 1.5,
        "standout_dish": "Whole Suckling Pig (advance order)",
        "description": "Wood-fired Iberian cooking at its most theatrical. Order the whole pig, take the best table, and don't rush.",
        "tags": ["wood-fired", "wine cave", "whole animal", "groups"],
        "open_now": True,
        "wait_minutes": 0,
        "emoji": "🔥",
        "music_match": "Flamenco / Spanish Guitar",
        "wine_match": "Rioja Gran Reserva",
    },
]

MOOD_VIBE_MAP = {
    "romantic":    ["romantic", "date night", "intimate", "quiet"],
    "adventurous": ["adventurous", "bold", "spicy"],
    "relaxed":     ["relaxed", "quiet", "casual", "mindful"],
    "celebratory": ["celebratory", "views", "social", "fun"],
    "group":       ["group", "family", "social", "fun"],
    "quick":       ["quick", "casual", "solo"],
    "healthy":     ["healthy", "light", "mindful"],
    "cozy":        ["cozy", "comfort", "casual", "family"],
}


def discover_restaurants(
    mood: str = "",
    cuisine: str = "",
    max_price_level: int = 4,
    max_wait_minutes: int = 60,
    open_now: bool = True,
) -> list:
    results = []
    target_vibes = MOOD_VIBE_MAP.get(mood.lower(), []) if mood else []

    for r in RESTAURANTS:
        if open_now and not r["open_now"]:
            continue
        if r["price_level"] > max_price_level:
            continue
        if r["wait_minutes"] > max_wait_minutes:
            continue
        if cuisine and cuisine.lower() not in r["cuisine"].lower():
            continue

        score = 0.0
        if target_vibes:
            matches = sum(1 for v in r["vibe"] if v in target_vibes)
            score += matches * 0.5
        score += r["rating"] * 0.2
        score += max(0, 5 - r["wait_minutes"] / 10) * 0.1

        results.append({**r, "_score": score})

    results.sort(key=lambda x: x["_score"], reverse=True)
    return [{k: v for k, v in r.items() if k != "_score"} for r in results[:8]]


def get_experience_plan(mood: str = "", cuisine: str = "", budget: str = "mid") -> dict:
    """Return a complete dining experience: restaurant + music genre + wine/drink."""
    price_map = {"budget": 2, "mid": 3, "luxury": 4}
    max_price = price_map.get(budget, 3)

    restaurants = discover_restaurants(mood=mood, cuisine=cuisine, max_price_level=max_price)
    restaurant  = restaurants[0] if restaurants else RESTAURANTS[0]

    music_map = {
        "romantic":    {"genre": "Jazz / Bossa Nova",    "vibe": "Soft, intimate, slow"},
        "adventurous": {"genre": "World Music / Afrobeat","vibe": "Energetic, exploratory"},
        "relaxed":     {"genre": "Acoustic / Lo-fi",      "vibe": "Calm, unhurried"},
        "celebratory": {"genre": "Lounge / Deep House",   "vibe": "Upbeat, celebratory"},
        "group":       {"genre": "Pop / Hip-Hop",         "vibe": "Fun, social, singalong"},
        "cozy":        {"genre": "Jazz / Indie Folk",     "vibe": "Warm, comforting"},
        "healthy":     {"genre": "Acoustic / Ambient",    "vibe": "Fresh, mindful"},
        "quick":       {"genre": "Café Pop",              "vibe": "Light, background"},
    }
    music = music_map.get(mood.lower(), {"genre": restaurant["music_match"], "vibe": "Curated for your meal"})

    drink_map = {
        4: "🍷 " + restaurant["wine_match"],
        3: "🍷 " + restaurant["wine_match"],
        2: "🍺 Craft beer or house wine",
        1: "🧃 Soft drink or house water",
    }
    drink = drink_map.get(min(restaurant["price_level"], 4), "🍷 House wine")

    return {
        "restaurant": restaurant,
        "music":      music,
        "drink":      drink,
        "mood":       mood,
        "experience_title": _experience_title(mood),
    }


def _experience_title(mood: str) -> str:
    titles = {
        "romantic":    "A night to remember 🥂",
        "adventurous": "Your next great food story 🌍",
        "celebratory": "Celebrate every bite 🎉",
        "relaxed":     "No rush. Just good food. ✨",
        "group":       "The whole crew. One perfect table. 👥",
        "cozy":        "Pull up a chair. Stay a while. 🕯️",
        "healthy":     "Feel good from the first bite 🌿",
    }
    return titles.get(mood.lower(), "Your perfect dining experience 🍽️")
