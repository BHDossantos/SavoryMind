"""Tests for the wedge → B2B matcher.

Pins the ranking that powers "Book a table that serves it" under
Mood-to-Meal: same-city + cuisine match wins, then same-city, then
any-city + cuisine, capped at 3. Empty when nothing fits — the
consumer UI relies on that.
"""
import json
from datetime import datetime

from app.models.user import User
from app.services import restaurant_matcher


def _make(db, *, name, city, cuisines, completed=True, slug=None):
    u = User(
        email=f"{name}@example.com",
        password_hash="x",
        display_name=name,
        restaurant_name=name,
        account_type="restaurant",
        onboarding_completed=completed,
        city=city,
        country="Italy",
        restaurant_cuisine=json.dumps(cuisines) if cuisines is not None else None,
        slug=slug or name.lower().replace(" ", "-"),
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


def test_same_city_and_cuisine_ranks_first(client, db_session):
    """Roma + Italian (bucket 1) beats Roma + Japanese (bucket 2 —
    being in the right city outranks matching the cuisine elsewhere)
    which beats Milano + Italian (bucket 3)."""
    a = _make(db_session, name="Trattoria Roma", city="Roma",  cuisines=["Italian"])
    b = _make(db_session, name="Sushi Roma",    city="Roma",  cuisines=["Japanese"])
    c = _make(db_session, name="Osteria Milano", city="Milano", cuisines=["Italian"])

    out = restaurant_matcher.find_matches(db_session, cuisine="Italian", city="Roma")
    assert [r["slug"] for r in out] == [a.slug, b.slug, c.slug]


def test_same_city_only_match_when_no_cuisine(client, db_session):
    """If we don't know the cuisine but do know the city, same-city
    matches should still come back ordered first."""
    a = _make(db_session, name="Cafe Roma", city="Roma", cuisines=["Italian"])
    b = _make(db_session, name="Cafe Milano", city="Milano", cuisines=["Italian"])
    out = restaurant_matcher.find_matches(db_session, cuisine=None, city="Roma")
    assert out[0]["slug"] == a.slug


def test_filters_to_onboarded_with_slug(client, db_session):
    """An onboarding-incomplete row or one missing a slug isn't
    bookable, so it shouldn't surface in a consumer recommendation."""
    _make(db_session, name="Halfway", city="Roma", cuisines=["Italian"], completed=False)
    # Explicitly NULL out the slug after creation — the helper would
    # otherwise auto-derive one from the display_name.
    no_slug = _make(db_session, name="No Slug Place", city="Roma", cuisines=["Italian"])
    no_slug.slug = None
    db_session.commit()
    good = _make(db_session, name="Real Place", city="Roma", cuisines=["Italian"])
    out = restaurant_matcher.find_matches(db_session, cuisine="Italian", city="Roma")
    assert [r["slug"] for r in out] == [good.slug]


def test_caps_at_limit(client, db_session):
    for i in range(7):
        _make(db_session, name=f"Trattoria {i}", city="Roma", cuisines=["Italian"])
    out = restaurant_matcher.find_matches(db_session, cuisine="Italian", city="Roma", limit=3)
    assert len(out) == 3


def test_empty_when_nothing_fits(client, db_session):
    _make(db_session, name="Roman Place", city="Roma", cuisines=["Italian"])
    out = restaurant_matcher.find_matches(db_session, cuisine="Italian", city="Tokyo")
    # Roman place still surfaces — bucket 3 (any city + cuisine match)
    assert len(out) == 1
    # Now ask for Japanese in Tokyo — no signed-up Japanese, no Tokyo
    out2 = restaurant_matcher.find_matches(db_session, cuisine="Japanese", city="Tokyo")
    assert out2 == []


def test_dto_omits_pii(client, db_session):
    """Email + phone must NOT leak to the public consumer endpoint."""
    r = _make(db_session, name="Trattoria Roma", city="Roma", cuisines=["Italian"])
    r.phone = "+393334445566"
    db_session.commit()
    out = restaurant_matcher.find_matches(db_session, cuisine="Italian", city="Roma")
    assert "email" not in out[0]
    assert "phone" not in out[0]
    # And the book_url deep-links to the guest booking page.
    assert out[0]["book_url"] == f"/r/{r.slug}"


def test_cuisine_match_is_case_and_punctuation_insensitive(client, db_session):
    """A row whose cuisine reads 'italian / mediterranean' should still
    match 'Italian'."""
    r = _make(db_session, name="Trattoria", city="Roma", cuisines=["italian / mediterranean"])
    out = restaurant_matcher.find_matches(db_session, cuisine="Italian", city="Roma")
    assert [x["slug"] for x in out] == [r.slug]


# ── End-to-end through the /mood-to-meal endpoint ────────────────────────

def test_mood_to_meal_returns_matched_restaurants_when_going_out(client, db_session):
    """The full wedge → bridge: AI returns a dish with cuisine='Italian',
    user is going out in Roma, and a Roman trattoria exists. The endpoint
    response carries the matched restaurant."""
    r = _make(db_session, name="Trattoria Roma", city="Roma", cuisines=["Italian"])

    from unittest.mock import patch
    rec = {
        "dish": "Cacio e pepe", "dish_desc": "x",
        "drink": "Frascati", "drink_desc": "x",
        "music_vibe": "x", "dessert": "x",
        "share_title": "x", "share_subtitle": "x",
        "cuisine": "Italian",
    }
    with patch("app.services.mood_to_meal_service.claude_client.call_json", return_value=rec):
        res = client.post("/api/discover/mood-to-meal", json={
            "mood": "cozy", "experience": "indulgent", "budget": "medium",
            "location": "Roma", "at_home": False,
        })
    assert res.status_code == 200
    body = res.json()
    assert body["recommendation"]["cuisine"] == "Italian"
    assert len(body["restaurants"]) == 1
    assert body["restaurants"][0]["slug"] == r.slug
    assert body["restaurants"][0]["book_url"] == f"/r/{r.slug}"


def test_mood_to_meal_skips_matching_when_at_home(client, db_session):
    _make(db_session, name="Trattoria Roma", city="Roma", cuisines=["Italian"])

    from unittest.mock import patch
    with patch("app.services.mood_to_meal_service.claude_client.call_json", return_value={
        "dish": "Pasta", "dish_desc": "x",
        "drink": "Water", "drink_desc": "x",
        "music_vibe": "x", "dessert": "x",
        "share_title": "x", "share_subtitle": "x",
        "cuisine": "Italian",
    }):
        res = client.post("/api/discover/mood-to-meal", json={
            "mood": "cozy", "experience": "fast", "budget": "low",
            "at_home": True,
        })
    assert res.status_code == 200
    assert res.json()["restaurants"] == []
