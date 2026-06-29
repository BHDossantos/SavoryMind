import json
import re
from sqlalchemy.orm import Session
from ..models.consumer import WinePairing

# WINE_DB used to be a 130-line inline literal here. Moved to
# backend/app/data/wines.json so the catalog can be expanded
# without touching this file. Loaded once per process via the
# data.get_wines() helper.
from ..data import get_wines


WINE_DB = get_wines()


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
