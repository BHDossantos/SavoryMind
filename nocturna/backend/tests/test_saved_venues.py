from app.api.routes.saved import _slugs, _set_slugs
from app.models import User, Venue
from app.core.security import hash_password


def _user(db, prefs=None):
    u = User(email="u@example.com", password_hash=hash_password("x"),
             role="user", prefs=prefs or {})
    db.add(u); db.commit(); db.refresh(u); return u


def _venue(db, slug):
    v = Venue(slug=slug, name=slug, type="bar", address="X", lat=41.9, lng=12.5,
              neighborhood="Centro", city="rome", country="IT",
              opening_hours={}, avg_price_eur=40, price_level=2, dress_code="casual",
              music_types=[], crowd_types=[], vibe_tags=[], cuisine_tags=[],
              contact={}, photos=[], best_nights=[], active=True, quality_score=0.8)
    db.add(v); db.commit(); db.refresh(v); return v


def test_slug_helpers_round_trip(db):
    u = _user(db)
    assert _slugs(u) == []
    _set_slugs(u, ["a", "b"]); db.commit()
    db.refresh(u)
    assert _slugs(u) == ["a", "b"]
    # prefs object preserved on top of saved list
    u.prefs = {**u.prefs, "music": ["jazz"]}
    db.commit(); db.refresh(u)
    _set_slugs(u, ["a"]); db.commit(); db.refresh(u)
    assert u.prefs.get("music") == ["jazz"]
    assert _slugs(u) == ["a"]


def test_toggle_via_route(db):
    """Hit /api/saved-venues/toggle through TestClient with auth."""
    import os, sys
    os.environ["NOCTURNA_DATABASE_URL"] = "sqlite:///:memory:"
    os.environ["NOCTURNA_SEED_ON_STARTUP"] = "false"
    sys.path.insert(0, ".")
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.db import SessionLocal

    with TestClient(app) as client:
        d = SessionLocal()
        _user(d)
        _venue(d, "v1")
        d.close()

        r = client.post("/api/auth/login", json={"email": "u@example.com", "password": "x"})
        assert r.status_code == 200, r.text
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}

        r = client.post("/api/saved-venues/toggle", json={"slug": "v1"}, headers=h)
        assert r.json() == {"saved": True, "slugs": ["v1"]}

        r = client.get("/api/saved-venues", headers=h)
        assert [x["slug"] for x in r.json()] == ["v1"]

        r = client.post("/api/saved-venues/toggle", json={"slug": "v1"}, headers=h)
        assert r.json() == {"saved": False, "slugs": []}

        # Unknown slug — no-op
        r = client.post("/api/saved-venues/toggle", json={"slug": "ghost"}, headers=h)
        assert r.json()["saved"] is False
