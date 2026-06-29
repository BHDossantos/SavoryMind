"""Slug generation for restaurant public booking links.

A restaurant's slug backs `/r/{slug}` — the public, no-signup booking
URL they share with their diners. Generated from the restaurant name on
the first profile update where the restaurant has a name but no slug.

Rules:
- lowercase, ASCII-only (transliterate Italian accents: à→a, è→e, etc.)
- alphanumeric + single hyphens, no leading/trailing hyphen
- max 60 chars before suffix, total cap 80 (matches the column)
- collisions resolved by appending -2, -3, … in order
"""
from __future__ import annotations

import re
import unicodedata
from sqlalchemy.orm import Session

from ..models.user import User


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """Convert an arbitrary restaurant name to a URL-safe base slug.

    Returns empty string for inputs that contain no usable characters
    (caller falls back to a numeric slug in that case).
    """
    if not name:
        return ""
    # Strip accents → "L'Osteria del Borgo" → "L'Osteria del Borgo" (still has ').
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    # Collapse contractions (Italian L'/D'/dell', French d'/l', English 's)
    # before hyphenation so "L'Osteria" → "losteria", not "l-osteria".
    no_apos = ascii_only.replace("'", "").replace("’", "").replace("`", "")
    lower = no_apos.lower()
    # Collapse runs of non-alphanumeric into a single hyphen
    hyphenated = _SLUG_RE.sub("-", lower).strip("-")
    return hyphenated[:60]


def unique_slug(db: Session, base: str) -> str:
    """Return `base` if no other user has it, else base-2, base-3, …

    Empty base is replaced with a numeric placeholder so the caller still
    gets a usable slug — restaurants with no name yet shouldn't crash
    onboarding completion.
    """
    if not base:
        base = "restaurant"
    candidate = base
    n = 1
    while db.query(User.id).filter(User.slug == candidate).first():
        n += 1
        candidate = f"{base}-{n}"
        if len(candidate) > 80:
            # Truncate the base if the suffix would overflow the column
            keep = 80 - len(f"-{n}")
            candidate = f"{base[:keep]}-{n}"
    return candidate


def ensure_restaurant_slug(db: Session, user: User) -> None:
    """If `user` is an onboarded restaurant with a name but no slug, set one.

    Idempotent: no-op when slug is already set or the account isn't a
    restaurant. Commit is the caller's responsibility.
    """
    if user.account_type != "restaurant":
        return
    if user.slug:
        return
    if not user.restaurant_name and not user.display_name:
        return
    base = slugify(user.restaurant_name or user.display_name)
    user.slug = unique_slug(db, base)
