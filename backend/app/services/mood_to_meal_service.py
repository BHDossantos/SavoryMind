"""Mood-to-Meal AI — SavoryMind's consumer wedge feature.

Given a user's taste profile (favorite cuisines, dietary, spice, etc.)
and their current context (mood, experience, budget, location), returns
a single shareable recommendation: dish + drink + music vibe + dessert
+ a poetic share title.

Public endpoint, no auth required — diners can try once without signing
up. If they're signed in, their stored taste profile augments the
context for a better personalized result.

The whole call is one Claude JSON request with ephemeral cache on the
system prompt; per-request cost is bounded and most repeat-context
requests serve from cache.
"""
from __future__ import annotations

from typing import Optional

from . import claude_client


_SCHEMA = {
    "type": "object",
    "properties": {
        "dish":           {"type": "string", "description": "A specific real dish name (e.g. 'Cacio e pepe', not 'pasta')."},
        "dish_desc":      {"type": "string", "description": "One sentence on why this dish, evocative and confident."},
        "drink":          {"type": "string", "description": "A specific drink — wine, cocktail, beer, or non-alcoholic if dietary requires."},
        "drink_desc":     {"type": "string", "description": "One sentence on the pairing logic."},
        "music_vibe":     {"type": "string", "description": "A short evocative music mood (e.g. 'jazz at midnight on vinyl')."},
        "dessert":        {"type": "string", "description": "A specific dessert."},
        "share_title":    {"type": "string", "description": "A poetic one-line summary the user shares socially (e.g. 'Tonight you are: truffle pasta, Chianti, jazz at midnight')."},
        "share_subtitle": {"type": "string", "description": "Short context line (e.g. 'cozy mood, medium budget, Italian soul')."},
    },
    "required": ["dish", "dish_desc", "drink", "drink_desc", "music_vibe", "dessert", "share_title", "share_subtitle"],
}


def _system_prompt(language: str) -> str:
    """The system prompt is shared across requests so Claude caches it.
    Per-request signals go in the user payload."""
    base = claude_client.flavor_persona_for(language)
    task = """
You are SavoryMind's Mood-to-Meal recommendation engine.

Given a person's taste profile and their current mood/context, return
ONE confident recommendation as JSON:
  - a specific real dish (name it, don't say "pasta")
  - a specific drink that pairs (alcohol-free when dietary requires)
  - a short music-vibe phrase
  - a dessert
  - a poetic share_title summarising the whole vibe in one line
  - a one-line share_subtitle giving the context

Rules:
  - Match the user's dietary restrictions strictly. Never recommend
    something they listed as a dislike or allergy.
  - Respect budget — €€€ can suggest tasting menus; € sticks to
    bistro/casual.
  - If `location` is given, lean toward that culture's authentic dishes.
  - If `at_home=true`, suggest something cookable at home; otherwise
    assume they're going out.
  - share_title should feel like a personality, not a menu. "Tonight you
    are…" or equivalent in the user's language.
  - Be confident. No "you could try" — say what they should order.
  - Respond in the user's language end-to-end.
"""
    return f"{base}\n\n{task.strip()}"


def recommend(
    *,
    mood: str,
    experience: str,
    budget: str,
    location: Optional[str] = None,
    at_home: bool = False,
    language: str = "en",
    cuisines: Optional[list[str]] = None,
    dietary: Optional[list[str]] = None,
    dislikes: Optional[list[str]] = None,
    spice: Optional[str] = None,
    non_alcoholic: bool = False,
) -> Optional[dict]:
    """Run one Claude call and return the recommendation dict, or None if
    Claude isn't configured / refused / returned malformed JSON."""
    payload = {
        "context": {
            "mood":           mood,
            "experience":     experience,
            "budget":         budget,
            "location":       location,
            "at_home":        at_home,
            "language":       language,
            "non_alcoholic":  non_alcoholic,
        },
        "taste": {
            "cuisines": cuisines or [],
            "dietary":  dietary  or [],
            "dislikes": dislikes or [],
            "spice":    spice,
        },
    }
    return claude_client.call_json(
        system_prompt=_system_prompt(language),
        user_payload=payload,
        schema=_SCHEMA,
        max_tokens=600,
    )
