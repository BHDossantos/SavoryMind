from datetime import datetime

import pytest

from app.models import Venue
from app.services import scoring
from app.services.recommender import PlannerInput, generate_plans


def _hours_all_day():
    return {d: [{"open": "00:00", "close": "23:59"}] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def _hours_night():
    return {d: [{"open": "23:30", "close": "05:00"}] for d in ["fri", "sat"]}


def make_venue(db, **kw):
    defaults = dict(
        slug=kw.get("slug", "v"),
        name=kw.get("name", "Test"),
        type="restaurant",
        address="x",
        lat=41.9, lng=12.5,
        neighborhood="Centro",
        city="rome",
        country="IT",
        opening_hours=_hours_all_day(),
        avg_price_eur=60,
        price_level=2,
        dress_code="casual",
        music_types=[],
        crowd_types=[],
        vibe_tags=[],
        cuisine_tags=[],
        contact={},
        photos=[],
        best_nights=[],
        active=True,
        quality_score=0.8,
    )
    defaults.update(kw)
    v = Venue(**defaults)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def test_haversine():
    assert scoring.haversine_km(41.9, 12.5, 41.9, 12.5) == 0
    assert 0 < scoring.haversine_km(41.9, 12.5, 41.91, 12.51) < 2


def test_jaccard_basic():
    assert scoring.jaccard(["a", "b"], ["a", "c"]) == pytest.approx(1 / 3)


def test_dress_compatible():
    assert scoring.dress_compatible("elegant", "casual")
    assert not scoring.dress_compatible("casual", "luxury")


def test_club_hour_filter(db):
    make_venue(
        db,
        slug="club1",
        type="club",
        opening_hours=_hours_night(),
        vibe_tags=["wild"],
    )
    inp = PlannerInput(
        intent="dancing",
        requested_for=datetime(2026, 4, 24, 22, 0),  # Friday at 22:00 — too early for club
        vibe_tags=["wild"],
        budget_band="50-100",
    )
    plans = generate_plans(db, inp)
    assert plans == []


def test_club_at_proper_hour(db):
    make_venue(db, slug="club2", type="club", opening_hours=_hours_night(), vibe_tags=["wild"])
    inp = PlannerInput(
        intent="dancing",
        requested_for=datetime(2026, 4, 24, 23, 45),
        vibe_tags=["wild"],
        budget_band="50-100",
    )
    plans = generate_plans(db, inp)
    assert plans
    assert plans[0]["stops"][0]["type"] == "club"


def test_budget_filter_blocks_high_end_for_low_budget(db):
    make_venue(db, slug="lux", type="restaurant", price_level=4, avg_price_eur=200)
    inp = PlannerInput(intent="dinner", budget_band="25-50")
    plans = generate_plans(db, inp)
    assert plans == []


def test_promoted_cap_one_per_plan(db):
    make_venue(db, slug="r1", type="restaurant", promoted=True, vibe_tags=["romantic"])
    make_venue(db, slug="b1", type="bar", promoted=True, vibe_tags=["romantic"], opening_hours=_hours_all_day())
    make_venue(db, slug="b2", type="bar", promoted=False, vibe_tags=["romantic"], opening_hours=_hours_all_day())
    inp = PlannerInput(intent="dinner_drinks", vibe_tags=["romantic"], budget_band="50-100",
                       requested_for=datetime(2026, 4, 24, 21, 0), plan_count=1)
    plans = generate_plans(db, inp)
    assert plans
    promoted_in_plan = sum(1 for s in plans[0]["stops"] if s["promoted"])
    assert promoted_in_plan <= 1
