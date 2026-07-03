"""Tests for the public marketplace surface: ratings aggregation, public
menu, public reviews, geo near-me search, and the removal of the old
fictional /diner/discover endpoint."""
from datetime import date

from app.models.diner import DinerReview
from app.models.menu import MenuItem
from app.models.user import User
from app.services.discover_service import haversine_km

from .conftest import register_user, auth_headers


def _onboard_restaurant(client, db_session, email, name, **extra):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.display_name = name
    row.onboarding_completed = True
    for k, v in extra.items():
        setattr(row, k, v)
    db_session.commit()
    return token, user["id"]


# ── Haversine ─────────────────────────────────────────────────────────────────

def test_haversine_known_distance():
    # Rome → Milan is ~477 km
    d = haversine_km(41.9028, 12.4964, 45.4642, 9.1900)
    assert 460 < d < 500


def test_haversine_zero():
    assert haversine_km(41.9, 12.5, 41.9, 12.5) == 0


# ── Ratings on discover ───────────────────────────────────────────────────────

def test_discover_includes_rating_aggregate(client, db_session):
    _, rid = _onboard_restaurant(client, db_session, "r1@example.com", "Trattoria Uno")
    _, diner = register_user(client, email="d1@example.com", account_type="consumer")
    db_session.add_all([
        DinerReview(diner_user_id=diner["id"], restaurant_user_id=rid, rating=5.0, comment="Great"),
        DinerReview(diner_user_id=diner["id"], restaurant_user_id=rid, rating=4.0, comment="Good"),
    ])
    db_session.commit()

    res = client.get("/api/discover/restaurants")
    assert res.status_code == 200
    r = next(x for x in res.json() if x["id"] == rid)
    assert r["rating"] == 4.5
    assert r["review_count"] == 2


def test_discover_zero_reviews_defaults(client, db_session):
    _, rid = _onboard_restaurant(client, db_session, "r2@example.com", "No Reviews Yet")
    res = client.get(f"/api/discover/restaurants/{rid}")
    assert res.status_code == 200
    assert res.json()["rating"] == 0.0
    assert res.json()["review_count"] == 0


def test_profile_includes_address_hours_slug(client, db_session):
    _, rid = _onboard_restaurant(
        client, db_session, "r3@example.com", "Casa Mia",
        street_address="Via Roma 1", opening_hours="Tue-Sun 12:00-23:00", slug="casa-mia",
    )
    body = client.get(f"/api/discover/restaurants/{rid}").json()
    assert body["street_address"] == "Via Roma 1"
    assert body["opening_hours"] == "Tue-Sun 12:00-23:00"
    assert body["slug"] == "casa-mia"


# ── Public menu ───────────────────────────────────────────────────────────────

def test_public_menu_excludes_cost(client, db_session):
    _, rid = _onboard_restaurant(client, db_session, "r4@example.com", "Menu House")
    db_session.add(MenuItem(user_id=rid, name="Carbonara", category="Mains",
                            price=14.0, cost=4.0, description="Classic"))
    db_session.commit()

    res = client.get(f"/api/discover/restaurants/{rid}/menu")
    assert res.status_code == 200
    items = res.json()["items"]
    # Registration seeds demo menu items; ours must be among them and no
    # item may ever leak the operator-private cost column.
    mine = next(i for i in items if i["name"] == "Carbonara")
    assert mine["price"] == 14.0
    assert all("cost" not in i for i in items)


def test_public_menu_404_unknown_restaurant(client):
    assert client.get("/api/discover/restaurants/99999/menu").status_code == 404


# ── Public reviews ────────────────────────────────────────────────────────────

def test_public_reviews_first_name_only(client, db_session):
    _, rid = _onboard_restaurant(client, db_session, "r5@example.com", "Review Place")
    _, diner = register_user(client, email="d5@example.com", account_type="consumer")
    row = db_session.query(User).filter(User.id == diner["id"]).first()
    row.first_name = "Maria"
    row.last_name = "Rossi"
    db_session.add(DinerReview(diner_user_id=diner["id"], restaurant_user_id=rid,
                               rating=5.0, comment="Wonderful evening"))
    db_session.commit()

    body = client.get(f"/api/discover/restaurants/{rid}/reviews").json()
    assert body["average_rating"] == 5.0
    assert body["review_count"] == 1
    assert body["reviews"][0]["diner_name"] == "Maria"
    assert "Rossi" not in str(body)


# ── Geo near-me ───────────────────────────────────────────────────────────────

def test_geo_sorts_nearest_first_and_radius_filters(client, db_session):
    _, near = _onboard_restaurant(client, db_session, "near@example.com", "Near",
                                  latitude=41.90, longitude=12.50)
    _, far = _onboard_restaurant(client, db_session, "far@example.com", "Far",
                                 latitude=45.46, longitude=9.19)  # Milan, ~477km away
    _, nopin = _onboard_restaurant(client, db_session, "nopin@example.com", "NoPin")

    # Sorted nearest-first; restaurants without a pin come last, not hidden.
    res = client.get("/api/discover/restaurants", params={"lat": 41.9028, "lng": 12.4964})
    names = [r["name"] for r in res.json()]
    assert names.index("Near") < names.index("Far") < names.index("NoPin")
    near_row = next(r for r in res.json() if r["name"] == "Near")
    assert near_row["distance_km"] < 5

    # Radius filter drops far + unpinned restaurants.
    res = client.get("/api/discover/restaurants",
                     params={"lat": 41.9028, "lng": 12.4964, "radius_km": 50})
    names = [r["name"] for r in res.json()]
    assert "Near" in names and "Far" not in names and "NoPin" not in names


def test_no_geo_params_means_no_distance_key(client, db_session):
    _onboard_restaurant(client, db_session, "plain@example.com", "Plain",
                        latitude=41.9, longitude=12.5)
    res = client.get("/api/discover/restaurants")
    assert all("distance_km" not in r for r in res.json())


# ── Mock endpoint removed ─────────────────────────────────────────────────────

def test_fictional_diner_discover_endpoint_is_gone(client):
    token, _ = register_user(client, email="gone@example.com", account_type="consumer")
    res = client.get("/api/diner/discover", headers=auth_headers(token))
    assert res.status_code in (404, 405)


# ── Profile update accepts the new public fields ──────────────────────────────

def test_restaurant_can_set_address_and_hours(client, db_session):
    token, rid = _onboard_restaurant(client, db_session, "r6@example.com", "Settable")
    res = client.patch("/api/auth/profile", headers=auth_headers(token), json={
        "street_address": "12 Via Garibaldi",
        "opening_hours": "Mon-Sat 18:00-23:30",
        "latitude": 41.9,
        "longitude": 12.5,
    })
    assert res.status_code == 200
    assert res.json()["street_address"] == "12 Via Garibaldi"
    body = client.get(f"/api/discover/restaurants/{rid}").json()
    assert body["opening_hours"] == "Mon-Sat 18:00-23:30"
    assert body["latitude"] == 41.9


# ── Public slug page carries rating + menu ────────────────────────────────────

def test_public_slug_page_includes_rating_and_menu(client, db_session):
    _, rid = _onboard_restaurant(client, db_session, "r7@example.com", "Slugged",
                                 slug="slugged")
    _, diner = register_user(client, email="d7@example.com", account_type="consumer")
    db_session.add(DinerReview(diner_user_id=diner["id"], restaurant_user_id=rid, rating=4.0))
    db_session.add(MenuItem(user_id=rid, name="Tiramisu", category="Desserts",
                            price=7.0, cost=2.0))
    db_session.commit()

    body = client.get("/api/public/restaurants/slugged").json()
    assert body["restaurant"]["rating"] == 4.0
    assert body["restaurant"]["review_count"] == 1
    names = [i["name"] for i in body["menu"]]
    assert "Tiramisu" in names
    assert all("cost" not in i for i in body["menu"])
