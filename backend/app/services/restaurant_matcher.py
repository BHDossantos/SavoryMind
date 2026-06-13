"""Match a Mood-to-Meal recommendation to onboarded, bookable restaurants.

The wedge → B2B bridge: when the AI says "Cacio e pepe" and the user
is in Rome going out, surface up to 3 real restaurants from the pilot
roster that serve Italian food, prioritising same-city matches. Each
match carries the `slug` so the frontend can deep-link straight to the
guest booking page (/r/{slug}).

Empty result is fine — when there are no signed-up restaurants in
their city, the consumer page just hides the section. The wedge still
delivers the magic moment; the matching is a bonus.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from sqlalchemy.orm import Session

from ..models.user import User


def _norm_city(s: str | None) -> str:
    return (s or "").strip().lower()


def _norm_cuisine(s: str | None) -> str:
    """Lowercase + strip accents-ish so 'italian' matches 'Italian',
    'italiana' (Italian endonym), and 'Italian / Mediterranean' rows."""
    return re.sub(r"[^a-z]+", "", (s or "").lower())


def _cuisines_of(restaurant: User) -> list[str]:
    """The restaurant_cuisine column is JSON text — tolerate a plain
    string or a malformed payload from legacy rows."""
    raw = restaurant.restaurant_cuisine
    if not raw:
        return []
    try:
        v = json.loads(raw)
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            return [v]
    except Exception:
        return [raw]
    return []


def _matches_cuisine(restaurant: User, cuisine: str) -> bool:
    if not cuisine:
        return True
    target = _norm_cuisine(cuisine)
    if not target:
        return True
    return any(target in _norm_cuisine(c) or _norm_cuisine(c) in target for c in _cuisines_of(restaurant))


def find_matches(
    db: Session,
    *,
    cuisine: str | None,
    city: str | None = None,
    country: str | None = None,
    limit: int = 3,
) -> list[dict]:
    """Return up to `limit` restaurant dicts that match the cuisine and
    (best-effort) city. Order:
      1. Same city + cuisine match
      2. Same city only
      3. Any city + cuisine match
    Cap at `limit` so the consumer card stays tight."""

    base = (
        db.query(User)
        .filter(
            User.account_type == "restaurant",
            User.onboarding_completed == True,  # noqa: E712
            User.slug.isnot(None),
        )
        .all()
    )

    norm_city = _norm_city(city)
    same_city_cuisine: list[User] = []
    same_city: list[User] = []
    any_city_cuisine: list[User] = []

    for r in base:
        city_hit = bool(norm_city) and _norm_city(r.city) == norm_city
        cuisine_hit = _matches_cuisine(r, cuisine or "")
        if city_hit and cuisine_hit:
            same_city_cuisine.append(r)
        elif city_hit:
            same_city.append(r)
        elif cuisine_hit:
            any_city_cuisine.append(r)

    ordered: list[User] = []
    for bucket in (same_city_cuisine, same_city, any_city_cuisine):
        for r in bucket:
            if r not in ordered:
                ordered.append(r)
            if len(ordered) >= limit:
                break
        if len(ordered) >= limit:
            break

    return [_to_dict(r) for r in ordered[:limit]]


def _to_dict(r: User) -> dict:
    """Slim DTO for the consumer card. We deliberately don't ship the
    restaurant's email, phone, or owner name — none of that helps a
    diner deciding where to book."""
    return {
        "slug":            r.slug,
        "display_name":    r.display_name,
        "restaurant_name": r.restaurant_name or r.display_name,
        "city":            r.city,
        "country":         r.country,
        "dining_style":    r.dining_style,
        "cuisines":        _cuisines_of(r),
        "book_url":        f"/r/{r.slug}" if r.slug else None,
    }
