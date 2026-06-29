"""Rule-based recipe recommendation engine."""

import re

# RECIPES moved to backend/app/data/recipes.json so the catalog can
# be expanded (target: 30 per cuisine) without bloating this file.
from ..data import get_recipes

RECIPES = get_recipes()



def get_recipe_recommendations(
    mood: str = "",
    cuisine: str = "",
    keywords: str = "",
    ingredients: str = "",
    max_time: int = 0,
    difficulty: str = "",
    n: int = 12,
) -> dict:
    """Return scored recipe list. ``ingredients`` is a comma-separated string of items on hand."""
    query      = f"{mood} {cuisine} {keywords}".lower().strip()
    ing_tokens = [t.strip().lower() for t in ingredients.split(",") if t.strip()] if ingredients else []
    scored     = []

    # When ANY filter is specified, results must actually match —
    # previously the 0.1 baseline score meant every non-matching recipe
    # still appeared, so picking "Cozy" / "Italian" / etc. did nothing.
    any_filter = bool(mood or cuisine or keywords or ing_tokens or max_time or difficulty)

    for recipe in RECIPES:
        # Cuisine is a HARD filter when specified.
        if cuisine and cuisine.lower() not in recipe["cuisine"].lower():
            continue

        # Mood is a HARD filter when specified.
        if mood and mood.lower() not in [m.lower() for m in recipe["mood"]]:
            continue

        # Time filter (hard exclude if max_time specified).
        if max_time and recipe["time_minutes"] > max_time:
            continue

        # Difficulty filter.
        if difficulty and recipe.get("difficulty", "").lower() != difficulty.lower():
            continue

        score = 0.0

        # Keyword match against recipe keyword pattern.
        if query and re.search(recipe["keywords"], query):
            score += 0.8

        # Mood score boost (on top of the hard filter above).
        if mood and mood.lower() in [m.lower() for m in recipe["mood"]]:
            score += 0.5

        # Cuisine score boost.
        if cuisine and cuisine.lower() in recipe["cuisine"].lower():
            score += 0.4

        # Ingredients-on-hand match.
        if ing_tokens:
            recipe_text = " ".join(recipe.get("ingredients", [])).lower()
            matched = sum(1 for t in ing_tokens if t in recipe_text)
            if matched > 0:
                score += 0.6 * (matched / len(ing_tokens))
                score += 0.3 * matched  # bonus per matched ingredient

        # When `keywords` is supplied as the ONLY filter (cravings,
        # occasions), require an actual keyword hit. Otherwise the
        # baseline 0.1 would once again let everything through.
        if keywords and not re.search(recipe["keywords"], query):
            continue

        if score == 0 and not any_filter:
            score = 0.1  # only fall back to baseline for the unfiltered default list

        scored.append((score, recipe))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = [r for _, r in scored[:n]]

    return {
        "query":   {"mood": mood, "cuisine": cuisine, "keywords": keywords, "ingredients": ingredients},
        "recipes": results,
        "total":   len(RECIPES),
    }


def get_recipe_by_id(recipe_id: int) -> dict | None:
    for r in RECIPES:
        if r["id"] == recipe_id:
            return r
    return None
