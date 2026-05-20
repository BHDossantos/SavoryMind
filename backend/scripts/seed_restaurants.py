"""Seed real-world restaurant accounts so the diner Discover screen has content.

Inserts ~30 well-known Boston and Rome restaurants as restaurant accounts with
``onboarding_completed=True`` so ``GET /discover/restaurants`` returns results
for the web AND mobile diner apps (both hit the same backend endpoint).

Idempotent: skips any email that already exists, so it is safe to re-run and
safe against production-like databases.

Run locally:
    cd backend && python -m scripts.seed_restaurants

Run against Cloud Run's database (via Cloud SQL Auth Proxy or a Cloud Run job):
    DATABASE_URL=postgresql://... python -m scripts.seed_restaurants

Override the shared login password:
    SEED_RESTAURANT_PASSWORD=MyPassword python -m scripts.seed_restaurants

NOTE: These are demo/seed accounts modelled on real restaurants. They are NOT
real SavoryMind partners; cuisine/style/descriptions were composed from public
information (the restaurants' own sites block automated scraping), and booking
availability is illustrative. Photos are intentionally omitted — the diner card
falls back to a dining-style icon when avatar_url is empty.

Every seeded account uses the @seed.savorymind.app email domain so the whole
set can be removed later in one statement:
    DELETE FROM users WHERE email LIKE '%@seed.savorymind.app';
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# Allow running as a plain script from inside backend/ — adds backend/ to
# sys.path so `app.*` imports resolve.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User  # noqa: E402


DEFAULT_PASSWORD = os.environ.get("SEED_RESTAURANT_PASSWORD", "SavorySeed!2026")
EMAIL_DOMAIN = "seed.savorymind.app"

# Time-slot presets (comma-separated "HH:MM" — the format discover_service
# expects). Roman dinner service runs later than in the US.
SLOTS_US_LUNCH_DINNER = "12:00,12:30,13:00,13:30,17:30,18:00,18:30,19:00,19:30,20:00,20:30,21:00"
SLOTS_US_DINNER = "17:00,17:30,18:00,18:30,19:00,19:30,20:00,20:30,21:00,21:30"
SLOTS_RM_LUNCH_DINNER = "12:30,13:00,13:30,14:00,19:30,20:00,20:30,21:00,21:30,22:00"
SLOTS_RM_DINNER = "19:30,20:00,20:30,21:00,21:30,22:00,22:30"

# ── Boston ──────────────────────────────────────────────────────────────────
# Region default applied in _build_rows(): country=USA
BOSTON = [
    {
        "name": "Neptune Oyster", "city": "Boston",
        "cuisine": "Seafood,Italian", "dining_style": "casual_fine",
        "bio": "A tiny, beloved North End raw bar famous for its warm-buttered "
               "and cold-mayo lobster rolls, pristine oysters, and "
               "Italian-inflected seafood.",
        "seating_capacity": 42, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Foodies,Tourists", "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "Oleana", "city": "Cambridge",
        "cuisine": "Mediterranean,Middle Eastern,Turkish",
        "dining_style": "casual_fine",
        "bio": "Chef Ana Sortun's Inman Square landmark for arabesque, "
               "spice-driven Eastern Mediterranean cooking and a romantic "
               "garden patio.",
        "seating_capacity": 75, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Foodies", "slots": SLOTS_US_DINNER,
    },
    {
        "name": "Toro", "city": "Boston",
        "cuisine": "Spanish,Tapas", "dining_style": "casual",
        "bio": "A buzzing South End tapas bar from Ken Oringer and Jamie "
               "Bissonnette, known for grilled corn with aioli and lime and a "
               "deep sherry list.",
        "seating_capacity": 90, "wine": True, "cocktails": True, "beer": True,
        "audience": "Friends,Couples,Foodies", "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "O Ya", "city": "Boston",
        "cuisine": "Japanese,Sushi", "dining_style": "fine_dining",
        "bio": "An intimate Leather District omakase counter delivering one of "
               "the country's most inventive and refined Japanese tasting "
               "menus.",
        "seating_capacity": 37, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Special Occasions", "slots": SLOTS_US_DINNER,
    },
    {
        "name": "No. 9 Park", "city": "Boston",
        "cuisine": "French,Italian", "dining_style": "fine_dining",
        "bio": "Barbara Lynch's elegant Beacon Hill flagship overlooking the "
               "Public Garden, pairing French and Italian technique with a "
               "celebrated prune-stuffed gnocchi.",
        "seating_capacity": 95, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Business,Special Occasions",
        "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "Grill 23 & Bar", "city": "Boston",
        "cuisine": "Steakhouse,American", "dining_style": "fine_dining",
        "bio": "Boston's quintessential power steakhouse in Back Bay, serving "
               "dry-aged, naturally raised beef beneath soaring mahogany and "
               "brass.",
        "seating_capacity": 200, "wine": True, "cocktails": True, "beer": True,
        "audience": "Business,Couples,Special Occasions",
        "slots": SLOTS_US_DINNER,
    },
    {
        "name": "Sarma", "city": "Somerville",
        "cuisine": "Turkish,Mediterranean,Mezze", "dining_style": "casual_fine",
        "bio": "A festive Somerville meyhane where roaming trays of mezze meet "
               "playful dishes like lentil nachos and harissa barbecue duck.",
        "seating_capacity": 80, "wine": True, "cocktails": True, "beer": True,
        "audience": "Friends,Couples,Foodies", "slots": SLOTS_US_DINNER,
    },
    {
        "name": "Giulia", "city": "Cambridge",
        "cuisine": "Italian", "dining_style": "casual_fine",
        "bio": "A warm Cambridge trattoria turning out handmade pasta on a "
               "communal table that doubles as the kitchen's prep counter by "
               "day.",
        "seating_capacity": 64, "wine": True, "cocktails": False, "beer": True,
        "audience": "Couples,Families", "slots": SLOTS_US_DINNER,
    },
    {
        "name": "Mistral", "city": "Boston",
        "cuisine": "French,Mediterranean", "dining_style": "fine_dining",
        "bio": "A perennially glamorous South End dining room serving "
               "French-Mediterranean classics to a see-and-be-seen crowd.",
        "seating_capacity": 170, "wine": True, "cocktails": True, "beer": True,
        "audience": "Business,Couples,Special Occasions",
        "slots": SLOTS_US_DINNER,
    },
    {
        "name": "Coppa", "city": "Boston",
        "cuisine": "Italian,Enoteca", "dining_style": "bistro",
        "bio": "A snug South End enoteca specializing in house salumi, "
               "wood-fired pizza, and rustic Italian small plates.",
        "seating_capacity": 55, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Friends", "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "Select Oyster Bar", "city": "Boston",
        "cuisine": "Seafood,Mediterranean", "dining_style": "casual_fine",
        "bio": "A sleek seafood spot tucked off Newbury Street with crudo, a "
               "daily raw bar, and Mediterranean-leaning plates.",
        "seating_capacity": 60, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Foodies", "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "Row 34", "city": "Boston",
        "cuisine": "Seafood,American", "dining_style": "casual",
        "bio": "A modern Fort Point oyster bar pairing a serious raw bar with "
               "a deep craft-beer list in an airy industrial space.",
        "seating_capacity": 120, "wine": True, "cocktails": True, "beer": True,
        "audience": "Friends,Families,Business", "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "Krasi", "city": "Boston",
        "cuisine": "Greek,Mezze,Mediterranean", "dining_style": "casual_fine",
        "bio": "A modern Greek meze bar in Back Bay built around the largest "
               "all-Greek wine list in the country.",
        "seating_capacity": 70, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Friends,Foodies", "slots": SLOTS_US_DINNER,
    },
    {
        "name": "Bar Mezzana", "city": "Boston",
        "cuisine": "Italian,Seafood", "dining_style": "casual_fine",
        "bio": "A bright South End spot for coastal Italian cooking, standout "
               "crudo, and fresh handmade pasta.",
        "seating_capacity": 85, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Friends", "slots": SLOTS_US_LUNCH_DINNER,
    },
    {
        "name": "Mamma Maria", "city": "Boston",
        "cuisine": "Italian", "dining_style": "fine_dining",
        "bio": "A romantic North End townhouse serving refined regional "
               "Italian cuisine across intimate candlelit rooms.",
        "seating_capacity": 90, "wine": True, "cocktails": False, "beer": True,
        "audience": "Couples,Special Occasions", "slots": SLOTS_US_DINNER,
    },
]

# ── Rome ────────────────────────────────────────────────────────────────────
# Region default applied in _build_rows(): country=Italy
ROME = [
    {
        "name": "Salumeria Roscioli", "city": "Rome",
        "cuisine": "Italian,Roman", "dining_style": "casual_fine",
        "bio": "A legendary deli-restaurant near Campo de' Fiori where "
               "museum-quality salumi and cheese meet a definitive carbonara "
               "and an encyclopedic wine cellar.",
        "seating_capacity": 50, "wine": True, "cocktails": False, "beer": True,
        "audience": "Couples,Foodies", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Armando al Pantheon", "city": "Rome",
        "cuisine": "Italian,Roman", "dining_style": "bistro",
        "bio": "A family-run institution steps from the Pantheon, faithfully "
               "serving Roman classics like carbonara, amatriciana, and coda "
               "alla vaccinara since 1961.",
        "seating_capacity": 50, "wine": True, "cocktails": False, "beer": False,
        "audience": "Couples,Families,Foodies", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Pierluigi", "city": "Rome",
        "cuisine": "Seafood,Italian", "dining_style": "casual_fine",
        "bio": "A see-and-be-seen seafood institution on a picturesque piazza "
               "near Campo de' Fiori, prized for crudo and the daily catch.",
        "seating_capacity": 120, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Business,Tourists", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "La Pergola", "city": "Rome",
        "cuisine": "Italian,Mediterranean,Fine Dining",
        "dining_style": "fine_dining",
        "bio": "Heinz Beck's three-Michelin-star rooftop atop the Rome "
               "Cavalieri — the city's pinnacle of haute cuisine with sweeping "
               "views over Rome.",
        "seating_capacity": 60, "wine": True, "cocktails": True, "beer": False,
        "audience": "Special Occasions,Couples,Business",
        "slots": SLOTS_RM_DINNER,
    },
    {
        "name": "Da Enzo al 29", "city": "Rome",
        "cuisine": "Italian,Roman", "dining_style": "casual",
        "bio": "A tiny, perpetually packed Trastevere trattoria celebrated for "
               "market-driven Roman cooking and top-quality ingredients.",
        "seating_capacity": 36, "wine": True, "cocktails": False, "beer": True,
        "audience": "Couples,Foodies", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Felice a Testaccio", "city": "Rome",
        "cuisine": "Italian,Roman", "dining_style": "bistro",
        "bio": "A Testaccio classic famous for its tableside-tossed cacio e "
               "pepe and unwavering devotion to Roman tradition.",
        "seating_capacity": 80, "wine": True, "cocktails": False, "beer": True,
        "audience": "Couples,Families", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Glass Hostaria", "city": "Rome",
        "cuisine": "Italian,Contemporary", "dining_style": "fine_dining",
        "bio": "A Michelin-starred, design-forward dining room in the heart of "
               "Trastevere where chef Cristina Bowerman reimagines Italian "
               "cuisine.",
        "seating_capacity": 45, "wine": True, "cocktails": True, "beer": False,
        "audience": "Couples,Foodies,Special Occasions",
        "slots": SLOTS_RM_DINNER,
    },
    {
        "name": "Pianostrada", "city": "Rome",
        "cuisine": "Italian,Contemporary", "dining_style": "casual_fine",
        "bio": "A bright, women-led kitchen near the Regola quarter known for "
               "inventive focaccia, seasonal plates, and a leafy courtyard.",
        "seating_capacity": 60, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Friends", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Trattoria Da Teo", "city": "Rome",
        "cuisine": "Italian,Roman", "dining_style": "casual",
        "bio": "A bustling Trastevere trattoria on a quiet piazza, beloved by "
               "locals for hearty, no-frills Roman home cooking.",
        "seating_capacity": 70, "wine": True, "cocktails": False, "beer": True,
        "audience": "Families,Couples", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Da Cesare al Casaletto", "city": "Rome",
        "cuisine": "Italian,Roman", "dining_style": "casual",
        "bio": "A Monteverde trattoria worth the tram ride, turning out "
               "impeccable fried starters and textbook carbonara and gricia.",
        "seating_capacity": 90, "wine": True, "cocktails": False, "beer": True,
        "audience": "Families,Foodies", "slots": SLOTS_RM_LUNCH_DINNER,
    },
    {
        "name": "Marco Martini Restaurant", "city": "Rome",
        "cuisine": "Italian,Contemporary,Mediterranean",
        "dining_style": "fine_dining",
        "bio": "A Michelin-starred greenhouse-style dining room near the "
               "Aventine where chef Marco Martini gives Roman flavors a "
               "creative, contemporary turn.",
        "seating_capacity": 40, "wine": True, "cocktails": True, "beer": False,
        "audience": "Couples,Special Occasions", "slots": SLOTS_RM_DINNER,
    },
    {
        "name": "Il Pagliaccio", "city": "Rome",
        "cuisine": "Italian,Contemporary,Fine Dining",
        "dining_style": "fine_dining",
        "bio": "A two-Michelin-star haven in the historic centre where chef "
               "Anthony Genovese blends Mediterranean and Asian influences "
               "into refined tasting menus.",
        "seating_capacity": 35, "wine": True, "cocktails": True, "beer": False,
        "audience": "Special Occasions,Couples", "slots": SLOTS_RM_DINNER,
    },
    {
        "name": "Zia Restaurant", "city": "Rome",
        "cuisine": "Italian,Contemporary", "dining_style": "fine_dining",
        "bio": "A husband-and-wife Michelin-starred restaurant in Trastevere "
               "offering a contemporary, seasonal take on Italian fine "
               "dining.",
        "seating_capacity": 30, "wine": True, "cocktails": True, "beer": False,
        "audience": "Couples,Special Occasions", "slots": SLOTS_RM_DINNER,
    },
    {
        "name": "Trattoria Pennestri", "city": "Rome",
        "cuisine": "Italian,Contemporary,Roman", "dining_style": "bistro",
        "bio": "A modern trattoria in the Ostiense district pairing Roman "
               "roots with seasonal, ingredient-led cooking and a thoughtful "
               "wine list.",
        "seating_capacity": 55, "wine": True, "cocktails": False, "beer": True,
        "audience": "Couples,Friends,Foodies", "slots": SLOTS_RM_DINNER,
    },
    {
        "name": "Antico Arco", "city": "Rome",
        "cuisine": "Italian,Mediterranean", "dining_style": "casual_fine",
        "bio": "A polished restaurant atop the Gianicolo hill blending Roman "
               "tradition with refined, creative Mediterranean dishes.",
        "seating_capacity": 75, "wine": True, "cocktails": True, "beer": True,
        "audience": "Couples,Business", "slots": SLOTS_RM_LUNCH_DINNER,
    },
]


def _email_for(name: str) -> str:
    """Stable, collision-resistant seed email derived from the name."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{slug}@{EMAIL_DOMAIN}"


def _build_rows() -> list[dict]:
    rows: list[dict] = []
    for spec in BOSTON:
        rows.append({**spec, "country": "USA"})
    for spec in ROME:
        rows.append({**spec, "country": "Italy"})
    return rows


def seed() -> int:
    db = SessionLocal()
    created = 0
    skipped = 0
    password_hash = hash_password(DEFAULT_PASSWORD)
    try:
        for spec in _build_rows():
            email = _email_for(spec["name"])
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                print(f"  skip   {email:<42} (id={existing.id}, exists)")
                skipped += 1
                continue

            user = User(
                email=email,
                password_hash=password_hash,
                account_type="restaurant",
                display_name=spec["name"],
                restaurant_name=spec["name"],
                bio=spec["bio"],
                avatar_url="",  # diner card falls back to a dining-style icon
                city=spec["city"],
                country=spec["country"],
                business_type="Restaurant",
                restaurant_cuisine=spec["cuisine"],
                service_type="Dine-in",
                dining_style=spec["dining_style"],
                target_audience=spec["audience"],
                seating_capacity=spec["seating_capacity"],
                serves_wine=spec["wine"],
                serves_cocktails=spec["cocktails"],
                serves_beer=spec["beer"],
                available_time_slots=spec["slots"],
                onboarding_completed=True,
            )
            db.add(user)
            db.commit()
            print(f"  create {email:<42} (id={user.id})")
            created += 1
    finally:
        db.close()

    print(f"\nDone. {created} created, {skipped} skipped.")
    if created:
        print(f"Login password for created accounts: {DEFAULT_PASSWORD!r}")
    print("Remove all seeded restaurants later with:")
    print(f"  DELETE FROM users WHERE email LIKE '%@{EMAIL_DOMAIN}';")
    return 0


if __name__ == "__main__":
    sys.exit(seed())
