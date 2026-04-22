import json
import re
from sqlalchemy.orm import Session
from ..models.consumer import WinePairing

WINE_DB = {
    "cabernet_sauvignon": {
        "name": "Cabernet Sauvignon",
        "style": "Full-bodied Red",
        "flavor_profile": "Blackcurrant, cedar, tobacco, dark chocolate, cassis",
        "regions": ["Napa Valley, USA", "Bordeaux, France", "Coonawarra, Australia"],
        "price_range": "$15 – $200+",
        "serving_temp": "16–18°C (61–64°F)",
        "decant": True,
        "decant_time": "30–60 minutes",
    },
    "malbec": {
        "name": "Malbec",
        "style": "Full-bodied Red",
        "flavor_profile": "Plum, blackberry, leather, tobacco, violet",
        "regions": ["Mendoza, Argentina", "Cahors, France"],
        "price_range": "$10 – $80",
        "serving_temp": "16–18°C (61–64°F)",
        "decant": True,
        "decant_time": "20–30 minutes",
    },
    "syrah": {
        "name": "Syrah / Shiraz",
        "style": "Bold Red",
        "flavor_profile": "Blackberry, smoked meat, black pepper, olive, dark chocolate",
        "regions": ["Barossa Valley, Australia", "Rhône Valley, France", "Washington State, USA"],
        "price_range": "$12 – $100",
        "serving_temp": "16–18°C (61–64°F)",
        "decant": True,
        "decant_time": "30 minutes",
    },
    "pinot_noir": {
        "name": "Pinot Noir",
        "style": "Light-bodied Red",
        "flavor_profile": "Cherry, raspberry, earthy notes, mushroom, vanilla",
        "regions": ["Burgundy, France", "Willamette Valley, USA", "Central Otago, NZ"],
        "price_range": "$15 – $300+",
        "serving_temp": "14–16°C (57–61°F)",
        "decant": False,
        "decant_time": None,
    },
    "chardonnay": {
        "name": "Chardonnay",
        "style": "Full-bodied White",
        "flavor_profile": "Apple, lemon, butter, vanilla, oak, tropical fruit",
        "regions": ["Burgundy, France", "Napa Valley, USA", "South Australia"],
        "price_range": "$10 – $150",
        "serving_temp": "10–13°C (50–55°F)",
        "decant": False,
        "decant_time": None,
    },
    "sauvignon_blanc": {
        "name": "Sauvignon Blanc",
        "style": "Crisp White",
        "flavor_profile": "Grapefruit, lime, passionfruit, cut grass, white peach",
        "regions": ["Marlborough, NZ", "Loire Valley, France", "Casablanca Valley, Chile"],
        "price_range": "$10 – $60",
        "serving_temp": "8–12°C (46–54°F)",
        "decant": False,
        "decant_time": None,
    },
    "pinot_grigio": {
        "name": "Pinot Grigio",
        "style": "Light White",
        "flavor_profile": "Lemon, green apple, pear, white flowers, almond",
        "regions": ["Alto Adige, Italy", "Alsace, France", "Oregon, USA"],
        "price_range": "$8 – $40",
        "serving_temp": "8–11°C (46–52°F)",
        "decant": False,
        "decant_time": None,
    },
    "riesling": {
        "name": "Riesling",
        "style": "Aromatic White",
        "flavor_profile": "Lime, green apple, peach, petrol (aged), honey, ginger",
        "regions": ["Mosel, Germany", "Alsace, France", "Clare Valley, Australia"],
        "price_range": "$10 – $80",
        "serving_temp": "7–10°C (45–50°F)",
        "decant": False,
        "decant_time": None,
    },
    "champagne": {
        "name": "Champagne / Sparkling",
        "style": "Sparkling",
        "flavor_profile": "Brioche, green apple, citrus, toast, cream, yeast",
        "regions": ["Champagne, France", "Franciacorta, Italy", "Cava, Spain"],
        "price_range": "$15 – $500+",
        "serving_temp": "6–9°C (43–48°F)",
        "decant": False,
        "decant_time": None,
    },
    "chianti": {
        "name": "Chianti / Sangiovese",
        "style": "Medium-bodied Red",
        "flavor_profile": "Cherry, plum, leather, tobacco, dried herbs, earthy",
        "regions": ["Tuscany, Italy", "Super Tuscan blends"],
        "price_range": "$10 – $100",
        "serving_temp": "15–18°C (59–64°F)",
        "decant": True,
        "decant_time": "20 minutes",
    },
    "rose": {
        "name": "Rosé",
        "style": "Dry Rosé",
        "flavor_profile": "Strawberry, watermelon, peach, rose, citrus zest",
        "regions": ["Provence, France", "Rioja, Spain", "Oregon, USA"],
        "price_range": "$10 – $50",
        "serving_temp": "8–12°C (46–54°F)",
        "decant": False,
        "decant_time": None,
    },
    "moscato": {
        "name": "Moscato / Muscat",
        "style": "Sweet White",
        "flavor_profile": "Peach, apricot, orange blossom, honey, tropical fruits",
        "regions": ["Piedmont, Italy", "Alsace, France", "California, USA"],
        "price_range": "$8 – $40",
        "serving_temp": "6–8°C (43–46°F)",
        "decant": False,
        "decant_time": None,
    },
    "port": {
        "name": "Port",
        "style": "Fortified Wine",
        "flavor_profile": "Fig, raisin, caramel, chocolate, nuts, dried fruit",
        "regions": ["Douro Valley, Portugal"],
        "price_range": "$15 – $200+",
        "serving_temp": "17–20°C (63–68°F)",
        "decant": True,
        "decant_time": "60 minutes (vintage)",
    },
}

PAIRING_RULES = [
    {
        "patterns": [
            r"\bbeef\b", r"\bsteak\b", r"\bribye\b", r"\bsirloin\b", r"\bbrisket\b",
            r"\bfilet\b", r"\bwagyu\b", r"\btenderloin\b", r"\bt-bone\b",
        ],
        "wines": [("cabernet_sauvignon", 0.95), ("malbec", 0.90), ("syrah", 0.82)],
        "rationale": "Bold tannins in these reds cut through beef's rich fat, cleansing the palate between bites.",
    },
    {
        "patterns": [r"\blamb\b", r"\brack of lamb\b", r"\bleg of lamb\b"],
        "wines": [("cabernet_sauvignon", 0.88), ("syrah", 0.85), ("chianti", 0.80)],
        "rationale": "Lamb's gamey richness is tamed by earthy, full-bodied reds with herbal notes.",
    },
    {
        "patterns": [r"\bsalmon\b", r"\btuna\b", r"\bduck\b", r"\bmushroom\b", r"\btruffle\b", r"\bporcini\b"],
        "wines": [("pinot_noir", 0.92), ("rose", 0.80), ("chardonnay", 0.75)],
        "rationale": "Salmon's fattiness and umami depth make Pinot Noir — a bridge red — the classic match.",
    },
    {
        "patterns": [r"\bchicken\b", r"\bturkey\b", r"\bveal\b", r"\bpork\b", r"\bpork chop\b", r"\bcheeks\b"],
        "wines": [("chardonnay", 0.88), ("pinot_noir", 0.83), ("pinot_grigio", 0.75)],
        "rationale": "White and light-red wines match poultry and pork's delicate, mild flavors without overpowering them.",
    },
    {
        "patterns": [r"\bpasta\b", r"\bragu\b", r"\bbolognese\b", r"\brisotto\b", r"\blasagna\b", r"\bgnocchi\b"],
        "wines": [("chianti", 0.90), ("malbec", 0.78), ("sauvignon_blanc", 0.72)],
        "rationale": "Italian dishes demand Italian wines — Sangiovese's acidity cuts through tomato sauce beautifully.",
    },
    {
        "patterns": [r"\bpizza\b", r"\bmargherita\b", r"\bnapoli\b", r"\bprosciutto\b"],
        "wines": [("chianti", 0.87), ("pinot_noir", 0.78), ("rose", 0.72)],
        "rationale": "Pizza's simple tomato and cheese profile pairs well with medium-bodied reds and dry rosé.",
    },
    {
        "patterns": [r"\bfish\b", r"\bcod\b", r"\bhalibut\b", r"\bsea bass\b", r"\btilapia\b", r"\bsnapper\b"],
        "wines": [("sauvignon_blanc", 0.93), ("pinot_grigio", 0.89), ("chardonnay", 0.80)],
        "rationale": "Crisp whites complement light fish without masking its delicate flavors.",
    },
    {
        "patterns": [r"\blobster\b", r"\bcrab\b", r"\bshrimp\b", r"\bprawn\b", r"\boyster\b", r"\bscallop\b", r"\bclam\b"],
        "wines": [("champagne", 0.95), ("sauvignon_blanc", 0.88), ("chardonnay", 0.82)],
        "rationale": "Sparkling wine's acidity and bubbles cleanse the palate from shellfish's brininess.",
    },
    {
        "patterns": [r"\bspicy\b", r"\bchili\b", r"\bcurry\b", r"\bsriracha\b", r"\bjalape[nñ]o\b", r"\bkimchi\b", r"\bsichuan\b"],
        "wines": [("riesling", 0.92), ("pinot_grigio", 0.85), ("champagne", 0.78)],
        "rationale": "Off-dry whites cool spice heat and contrast beautifully — never fight fire with bold tannins.",
    },
    {
        "patterns": [r"\bcheese\b", r"\bbrie\b", r"\bcamembert\b", r"\bgouda\b", r"\bcheddar\b", r"\bblue\b"],
        "wines": [("port", 0.88), ("champagne", 0.85), ("chardonnay", 0.78)],
        "rationale": "Cheese boards need contrast — Champagne's acidity cuts richness; Port matches aged cheeses.",
    },
    {
        "patterns": [r"\bchocolate\b", r"\btiramisu\b", r"\bcake\b", r"\bdessert\b", r"\bice cream\b", r"\bsorbet\b", r"\btart\b"],
        "wines": [("moscato", 0.90), ("port", 0.85), ("champagne", 0.75)],
        "rationale": "Sweet desserts need wines at least as sweet — otherwise the wine tastes sour and harsh.",
    },
    {
        "patterns": [r"\bsalad\b", r"\bcaesar\b", r"\bgreens\b", r"\bvegetable\b", r"\basparagus\b", r"\bherb\b"],
        "wines": [("sauvignon_blanc", 0.91), ("pinot_grigio", 0.85), ("rose", 0.78)],
        "rationale": "Herbaceous whites mirror the green, fresh flavors in salads and vegetable dishes.",
    },
]


def pair_wine(dish_name: str, dish_description: str | None = None) -> list[dict]:
    text = f"{dish_name} {dish_description or ''}".lower()
    wine_scores: dict[str, dict] = {}

    for rule in PAIRING_RULES:
        if any(re.search(pat, text) for pat in rule["patterns"]):
            for wine_key, confidence in rule["wines"]:
                if wine_key not in wine_scores or confidence > wine_scores[wine_key]["confidence"]:
                    wine_scores[wine_key] = {
                        **WINE_DB[wine_key],
                        "confidence": confidence,
                        "rationale": rule["rationale"],
                    }

    if not wine_scores:
        # Fallback: recommend safe, food-friendly wines
        for wine_key, confidence in [("pinot_noir", 0.70), ("sauvignon_blanc", 0.68), ("rose", 0.65)]:
            wine_scores[wine_key] = {
                **WINE_DB[wine_key],
                "confidence": confidence,
                "rationale": "These versatile, food-friendly wines complement a wide range of dishes.",
            }

    return sorted(wine_scores.values(), key=lambda w: w["confidence"], reverse=True)[:3]


def save_pairing(db: Session, user_id: int, dish_name: str, dish_description: str | None) -> WinePairing:
    import json
    recs = pair_wine(dish_name, dish_description)
    record = WinePairing(
        user_id=user_id,
        dish_name=dish_name,
        dish_description=dish_description,
        recommendations=json.dumps(recs),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_pairings(db: Session, user_id: int) -> list[WinePairing]:
    return db.query(WinePairing).filter(WinePairing.user_id == user_id).order_by(WinePairing.created_at.desc()).all()
