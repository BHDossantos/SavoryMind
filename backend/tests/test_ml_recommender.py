"""Tests for the ML consumer recommender + restaurant trending engine."""
from datetime import date, datetime, timedelta

from app.models.consumer import BehaviorLog
from app.models.restaurant_ext import SalesLog
from app.models.user import User
from app.services import ml_recommender_service as ml, menu_trending_service as trend

from .conftest import register_user, auth_headers


# --- Pure CF core (no DB) ---

def test_item_similarity_identical_items_are_similar():
    # Users 1,2 both interact with A and B → A,B highly similar.
    interactions = [
        (1, "A", 1.0), (1, "B", 1.0),
        (2, "A", 1.0), (2, "B", 1.0),
        (3, "C", 1.0),
    ]
    sim = ml.item_item_similarity(interactions)
    assert sim["A"]["B"] > 0.9
    assert "C" not in sim.get("A", {})  # no co-occurrence


def test_score_candidates_recommends_related():
    interactions = [
        (1, "A", 1.0), (1, "B", 1.0),
        (2, "A", 1.0), (2, "B", 1.0),
        (2, "C", 1.0),
    ]
    sim = ml.item_item_similarity(interactions)
    # A user who likes A should get B and C recommended (co-occur with A).
    ranked = ml.score_candidates({"A": 1.0}, sim)
    recommended = [item for item, _ in ranked]
    assert "B" in recommended


def test_popularity_ranks_by_weight():
    interactions = [(1, "A", 1.0), (2, "A", 1.0), (3, "B", 1.0)]
    pop = ml.popularity(interactions)
    assert pop[0][0] == "A"


# --- DB-backed recommender ---

def _consumer(db, email):
    from .conftest import register_user
    return None


def _log(db, user_id, action, meta):
    import json
    db.add(BehaviorLog(user_id=user_id, action_type=action, action_meta=json.dumps(meta)))
    db.commit()


def test_recommend_personalized(client, db_session):
    # Two users who both love Italian + wine; a third only Italian.
    t1, u1 = register_user(client, email="mlu1@example.com", account_type="consumer")
    t2, u2 = register_user(client, email="mlu2@example.com", account_type="consumer")
    t3, u3 = register_user(client, email="mlu3@example.com", account_type="consumer")
    for uid in (u1["id"], u2["id"]):
        _log(db_session, uid, "wine_pairing", {"cuisine": "italian"})
        _log(db_session, uid, "music_mood", {"mood": "romantic"})
    _log(db_session, u3["id"], "wine_pairing", {"cuisine": "italian"})

    ml.retrain(db_session)
    recs = ml.recommend_tokens(db_session, u3["id"])
    # u3 likes italian; u1/u2 who also like italian also like romantic mood
    # → romantic should surface as a personalized rec.
    tokens = [r["token"] for r in recs]
    assert any("romantic" in tk for tk in tokens)
    assert recs[0]["source"] in ("personalized", "popular")


def test_recommend_cold_start_is_popular(client, db_session):
    t1, u1 = register_user(client, email="mlcold1@example.com", account_type="consumer")
    t2, u2 = register_user(client, email="mlcold2@example.com", account_type="consumer")
    _log(db_session, u1["id"], "wine_pairing", {"cuisine": "japanese"})
    ml.retrain(db_session)
    recs = ml.recommend_tokens(db_session, u2["id"])  # u2 has no history
    assert recs
    assert recs[0]["source"] == "popular"


def test_ml_suggestions_endpoint(client, db_session):
    token, user = register_user(client, email="mlep@example.com", account_type="consumer")
    _log(db_session, user["id"], "wine_pairing", {"cuisine": "italian"})
    res = client.get("/api/consumer/ml-suggestions", headers=auth_headers(token))
    assert res.status_code == 200
    assert "suggestions" in res.json()


# --- Trending ---

def _restaurant(db, email="mltrend@example.com"):
    u = User(email=email, password_hash="x", display_name="R", restaurant_name="R",
             account_type="restaurant", onboarding_completed=True)
    db.add(u); db.commit(); db.refresh(u)
    return u


def _sale(db, uid, name, qty, days_ago):
    d = date.today() - timedelta(days=days_ago)
    db.add(SalesLog(user_id=uid, item_name=name, quantity=qty, revenue=qty * 10.0,
                    sale_date=d, hour_of_day=19, day_of_week=d.weekday()))
    db.commit()


def test_trending_detects_rising(db_session):
    rest = _restaurant(db_session)
    # "Pizza" accelerating: 2 last-prior-week, 10 this week.
    _sale(db_session, rest.id, "Pizza", 2, 10)
    _sale(db_session, rest.id, "Pizza", 10, 2)
    # "Soup" declining: 10 prior, 2 recent.
    _sale(db_session, rest.id, "Soup", 10, 10)
    _sale(db_session, rest.id, "Soup", 2, 2)
    out = trend.trending(db_session, rest.id)
    assert out["has_data"] is True
    rising_names = [r["item"] for r in out["rising"]]
    falling_names = [r["item"] for r in out["falling"]]
    assert "Pizza" in rising_names
    assert "Soup" in falling_names


def test_trending_empty(db_session):
    rest = _restaurant(db_session, email="mltrendempty@example.com")
    out = trend.trending(db_session, rest.id)
    assert out["has_data"] is False
    assert out["rising"] == []


def test_trending_endpoint(client, db_session):
    token, _ = register_user(client, email="mltrendep@example.com", account_type="restaurant")
    res = client.get("/api/restaurant/trending", headers=auth_headers(token))
    assert res.status_code == 200
    assert "rising" in res.json()


def test_trending_requires_restaurant(client, db_session):
    token, _ = register_user(client, email="mltrendcons@example.com", account_type="consumer")
    res = client.get("/api/restaurant/trending", headers=auth_headers(token))
    assert res.status_code == 403
