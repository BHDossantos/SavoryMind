"""Beer and spirits pairing engine — extends wine pairing concept."""

import re

# BEER_DB + SPIRITS_DB moved to backend/app/data/{beers,spirits}.json
# so they can be expanded without touching this file.
from ..data import get_beers, get_spirits

BEER_DB = get_beers()
SPIRITS_DB = get_spirits()


BEER_RULES = [
    {"pattern": r"burger|bbq|barbeque|wings|chicken|fried", "beers": [0, 3, 8], "reason": "Hoppy IPAs and crisp pilsners cut through fat and complement smoky char flavours."},
    {"pattern": r"pizza|pasta|italian|tomato|mozzarella", "beers": [4, 6, 9], "reason": "Malty ambers and saisons complement Italian herbaceous flavours."},
    {"pattern": r"spicy|curry|chilli|mexican|thai|indian", "beers": [0, 5, 8], "reason": "Hoppy bitterness and tart sours counterbalance heat and open up spice complexity."},
    {"pattern": r"seafood|fish|shrimp|oyster|crab|sushi|salmon", "beers": [2, 3, 5], "reason": "Light wheats and refreshing pilsners complement delicate seafood without overpowering it."},
    {"pattern": r"beef|steak|lamb|roast|red meat|ribs", "beers": [1, 4, 7], "reason": "Stout and porter's roasty depth mirrors the Maillard richness of red meats."},
    {"pattern": r"cheese|charcuterie|cheeseburger|cheddar|brie", "beers": [4, 9, 6], "reason": "Saisons and malty ambers create beautiful harmony with aged cheeses."},
    {"pattern": r"chocolate|dessert|cake|brownie|tiramisu", "beers": [1, 7], "reason": "Dark stout and porter mirror chocolate's bittersweet depth perfectly."},
    {"pattern": r"salad|vegetarian|vegan|light|greens|avocado", "beers": [2, 8, 5], "reason": "Wheat beers and session IPAs complement fresh, light dishes beautifully."},
    {"pattern": r"pork|bacon|sausage|ham", "beers": [3, 4, 6], "reason": "Pilsner's crispness and hefeweizen's banana notes elevate pork dishes."},
    {"pattern": r"duck|game|venison|wild", "beers": [7, 9, 4], "reason": "Porter and saison's complexity complements game's earthy depth."},
]

SPIRITS_RULES = [
    {"pattern": r"beef|steak|lamb|roast|smoked|bbq|ribs", "spirits": [0, 5], "reason": "Scotch and bourbon's oak and vanilla depth make them perfect companions for grilled and smoked meats."},
    {"pattern": r"mexican|taco|fajita|guacamole|salsa|nachos", "spirits": [1, 8], "reason": "Blanco tequila and mezcal are the natural partner for Mexican flavours — they share the same terroir."},
    {"pattern": r"seafood|fish|oyster|sushi|light|citrus|lemon", "spirits": [2, 9], "reason": "Gin's botanical brightness and pisco's floral character lift delicate seafood without overwhelming it."},
    {"pattern": r"tropical|caribbean|coconut|rum|banana|mango", "spirits": [3], "reason": "Dark rum's molasses and tropical spice notes are made for tropical flavour profiles."},
    {"pattern": r"dessert|chocolate|cake|pudding|cream|caramel", "spirits": [4, 5], "reason": "Cognac and bourbon's vanilla-caramel finish make them perfect dessert companions."},
    {"pattern": r"italian|pasta|pizza|cheese|prosciutto|antipasto", "spirits": [6], "reason": "A small Grappa after an Italian meal is a centuries-old tradition for a reason."},
    {"pattern": r"apple|pear|tart|fruit|normandy|cheese|camembert", "spirits": [7], "reason": "Calvados and apple-based dishes share the same core ingredient — a natural pairing."},
    {"pattern": r"spicy|curry|chilli|thai|indian|szechuan", "spirits": [1, 8], "reason": "Agave spirits cut through chilli heat while adding earthy complexity."},
    {"pattern": r"duck|game|venison|wild|pheasant", "spirits": [0, 5], "reason": "Whisky's depth and earthiness creates a natural harmony with game meats."},
    {"pattern": r"brunch|eggs|breakfast|avocado|smoked salmon", "spirits": [2, 9], "reason": "Gin-based Bloody Marys or Pisco Sours are classic brunch companions."},
]


def _top_matches(rules, db, dish: str, n: int = 3) -> list[dict]:
    dish_lower = dish.lower()
    scores: dict[int, float] = {}
    rationale: dict[int, str] = {}

    for rule in rules:
        if re.search(rule["pattern"], dish_lower):
            key = "beers" if "beers" in rule else "spirits"
            for i, idx in enumerate(rule[key]):
                score = 1.0 - i * 0.08
                if idx not in scores or scores[idx] < score:
                    scores[idx] = score
                    rationale[idx] = rule["reason"]

    if not scores:
        # fallback to crowd-pleasing picks
        for i in range(min(n, len(db))):
            scores[i] = 0.6 - i * 0.05
            rationale[i] = "A versatile choice that pairs well with most dishes."

    sorted_idxs = sorted(scores, key=lambda x: scores[x], reverse=True)[:n]
    results = []
    for idx in sorted_idxs:
        item = dict(db[idx])
        item["confidence"] = round(scores[idx], 2)
        item["rationale"] = rationale.get(idx, "")
        results.append(item)
    return results


def get_beer_pairings(dish: str) -> dict:
    matches = _top_matches(BEER_RULES, BEER_DB, dish, n=3)
    return {"dish": dish, "type": "beer", "pairings": matches}


def get_spirits_pairings(dish: str) -> dict:
    matches = _top_matches(SPIRITS_RULES, SPIRITS_DB, dish, n=3)
    return {"dish": dish, "type": "spirits", "pairings": matches}
