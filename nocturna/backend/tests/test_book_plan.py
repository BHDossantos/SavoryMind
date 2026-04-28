from datetime import datetime

from app.models import Plan, Venue
from app.api.routes.bookings import _default_request_type


def _hours_all_day():
    return {d: [{"open": "00:00", "close": "23:59"}] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def _make_venue(db, slug, vtype, **kw):
    defaults = dict(
        slug=slug, name=slug.title(), type=vtype, address="X", lat=41.9, lng=12.5,
        neighborhood="Centro", city="rome", country="IT",
        opening_hours=_hours_all_day(), avg_price_eur=60, price_level=2,
        dress_code="casual", music_types=[], crowd_types=[], vibe_tags=[],
        cuisine_tags=[], contact={}, photos=[], best_nights=[], active=True,
        quality_score=0.8,
    )
    defaults.update(kw)
    v = Venue(**defaults)
    db.add(v); db.commit(); db.refresh(v)
    return v


def test_default_request_type_mapping():
    assert _default_request_type("restaurant") == "dinner"
    assert _default_request_type("club") == "guestlist"
    assert _default_request_type("rooftop") == "bar_table"
    assert _default_request_type("speakeasy") == "bar_table"


def test_book_plan_via_testclient():
    """The full HTTP path: generate plan, then book all stops in one POST."""
    import os, sys
    os.environ["NOCTURNA_DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["NOCTURNA_SEED_ON_STARTUP"] = "false"
    sys.path.insert(0, ".")
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.db import SessionLocal
    from app.models import Venue as V

    with TestClient(app) as client:
        db = SessionLocal()
        _make_venue(db, "test-restaurant", "restaurant", vibe_tags=["romantic"])
        _make_venue(db, "test-bar", "bar", vibe_tags=["romantic"])
        db.close()

        r = client.post("/api/planner/generate", json={
            "city": "rome", "intent": "dinner_drinks",
            "requested_for": "2026-05-02T21:00:00",
            "vibe_tags": ["romantic"], "music_pref": [], "style": "casual",
            "group_type": "date", "group_size": 2,
            "budget_band": "50-100", "budget_per_person": 75, "plan_count": 1,
        })
        assert r.status_code == 200, r.text
        plan = r.json()["plans"][0]

        r = client.post(f"/api/bookings/plan/{plan['id']}", json={
            "contact_name": "Bruno", "contact_phone": "+1 555", "contact_email": "b@x.com",
            "group_size": 2,
        })
        assert r.status_code == 200, r.text
        bookings = r.json()["bookings"]
        assert len(bookings) == 2
        assert {b["request_type"] for b in bookings} == {"dinner", "bar_table"}

        r = client.get(f"/api/bookings/plan/{plan['id']}")
        assert r.status_code == 200
        assert r.json()["aggregate_status"] == "pending"
        assert len(r.json()["bookings"]) == 2
