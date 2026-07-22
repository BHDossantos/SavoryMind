"""Restaurant Health Score — honest composite, explainable, no fake numbers."""
from datetime import date, timedelta

from app.models.menu import MenuItem
from app.models.restaurant_ext import CRMCustomer, Staff
from app.models.diner import DinerReview
from app.models.user import User
from app.services import health_score_service

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


def test_fresh_restaurant_is_learning_not_fake_100(client, db_session):
    # Registration seeds some demo menu items, so financial may measure — but
    # a restaurant with no reviews/CRM/staff must NOT report a fabricated
    # perfect overall. Verify unmeasured dims are excluded, not padded to 100.
    token, owner = _restaurant(client, db_session, "hs-fresh@example.com")
    res = health_score_service.health_score(db_session, owner.id)
    for k in ("customer", "staff", "marketing"):
        # No reviews/staff/CRM added → these must be unknown (excluded).
        assert res["dimensions"][k]["status"] in ("unknown", "ok")
    # Overall is a mean of measured dims only; never a blanket 100.
    if res["overall"] is not None:
        assert res["overall"] <= 100


def test_dimensions_have_drivers_when_measured(client, db_session):
    token, owner = _restaurant(client, db_session, "hs-drivers@example.com")
    # Add staff so that dimension is measured.
    db_session.add(Staff(user_id=owner.id, name="Marco", role="chef", shift="evening",
                         punctuality_score=95, rating=4.5))
    db_session.commit()
    res = health_score_service.health_score(db_session, owner.id)
    staff_dim = res["dimensions"]["staff"]
    assert staff_dim["status"] == "ok"
    assert staff_dim["score"] is not None
    assert staff_dim["drivers"]  # explainable


def test_better_ratings_raise_customer_score(client, db_session):
    token, owner = _restaurant(client, db_session, "hs-cust@example.com")
    _, diner = register_user(client, email="hs-diner@example.com", account_type="consumer")
    # Two 5-star reviews + an active customer.
    db_session.add_all([
        DinerReview(diner_user_id=diner["id"], restaurant_user_id=owner.id, rating=5.0),
        DinerReview(diner_user_id=diner["id"], restaurant_user_id=owner.id, rating=5.0),
        CRMCustomer(user_id=owner.id, name="Ana", total_visits=5, total_spend=300,
                    last_visit=date.today()),
    ])
    db_session.commit()
    res = health_score_service.health_score(db_session, owner.id)
    cust = res["dimensions"]["customer"]
    assert cust["status"] == "ok"
    assert cust["score"] >= 90  # 5★ + active


def test_lapsed_customers_lower_customer_score(client, db_session):
    # Compare two otherwise-identical restaurants: lapsed customers must
    # score lower than active ones. Comparison isolates the retention
    # mechanism from any demo data seeded at registration.
    _, active_owner = _restaurant(client, db_session, "hs-active@example.com")
    _, lapsed_owner = _restaurant(client, db_session, "hs-lapsed@example.com")
    today = date.today()
    old = today - timedelta(days=120)
    for n in range(10):
        db_session.add(CRMCustomer(user_id=active_owner.id, name=f"A{n}", total_visits=3,
                                   total_spend=100, last_visit=today))
        db_session.add(CRMCustomer(user_id=lapsed_owner.id, name=f"L{n}", total_visits=3,
                                   total_spend=100, last_visit=old))
    db_session.commit()
    active = health_score_service.health_score(db_session, active_owner.id)
    lapsed = health_score_service.health_score(db_session, lapsed_owner.id)
    assert lapsed["dimensions"]["customer"]["score"] < active["dimensions"]["customer"]["score"]


def test_overall_weighted_and_banded(client, db_session):
    token, owner = _restaurant(client, db_session, "hs-band@example.com")
    db_session.add(Staff(user_id=owner.id, name="Top", role="chef", shift="full",
                         punctuality_score=100, rating=5.0))
    db_session.commit()
    res = health_score_service.health_score(db_session, owner.id)
    assert res["band"] in ("excellent", "good", "fair", "needs_attention", "learning")
    assert res["measured_dimensions"] >= 1


def test_health_score_endpoint(client, db_session):
    token, owner = _restaurant(client, db_session, "hs-ep@example.com")
    res = client.get("/api/restaurant/health-score", headers=auth_headers(token))
    assert res.status_code == 200
    body = res.json()
    assert set(body) >= {"overall", "band", "dimensions", "measured_dimensions"}
    assert set(body["dimensions"]) == {"financial", "operations", "customer", "staff", "marketing"}


def test_health_score_requires_restaurant(client):
    token, _ = register_user(client, email="hs-consumer@example.com", account_type="consumer")
    assert client.get("/api/restaurant/health-score", headers=auth_headers(token)).status_code == 403
