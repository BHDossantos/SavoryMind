"""Trigger-based marketing automation — birthday + lapsed, idempotent, owner-approve."""
from datetime import date, timedelta

from app.models.restaurant_ext import CRMCustomer
from app.models.marketing import MarketingTrigger
from app.models.notification import Notification
from app.models.user import User
from app.services import marketing_automation_service as mkt

from .conftest import register_user, auth_headers


def _restaurant(client, db_session, email):
    token, user = register_user(client, email=email, account_type="restaurant")
    row = db_session.query(User).filter(User.id == user["id"]).first()
    row.onboarding_completed = True
    db_session.commit()
    return token, row


def test_birthday_trigger_fires_and_notifies(client, db_session):
    token, owner = _restaurant(client, db_session, "mkt1@example.com")
    bday = date.today() + timedelta(days=3)
    c = CRMCustomer(user_id=owner.id, name="Maria", birthday=date(1990, bday.month, bday.day))
    db_session.add(c); db_session.commit()
    new = mkt.run_triggers(db_session, owner)
    assert any(t["type"] == "birthday" and t["name"] == "Maria" for t in new)
    # Owner got an in-app notification.
    assert db_session.query(Notification).filter(Notification.user_id == owner.id).count() >= 1


def test_lapsed_trigger_fires(client, db_session):
    token, owner = _restaurant(client, db_session, "mkt2@example.com")
    c = CRMCustomer(user_id=owner.id, name="Giovanni",
                    last_visit=date.today() - timedelta(days=45))
    db_session.add(c); db_session.commit()
    new = mkt.run_triggers(db_session, owner)
    assert any(t["type"] == "lapsed" and t["name"] == "Giovanni" for t in new)


def test_recent_visitor_no_lapsed_trigger(client, db_session):
    token, owner = _restaurant(client, db_session, "mkt3@example.com")
    db_session.add(CRMCustomer(user_id=owner.id, name="Recent",
                               last_visit=date.today() - timedelta(days=5)))
    db_session.commit()
    new = mkt.run_triggers(db_session, owner)
    assert not any(t["name"] == "Recent" for t in new)


def test_triggers_are_idempotent(client, db_session):
    token, owner = _restaurant(client, db_session, "mkt4@example.com")
    db_session.add(CRMCustomer(user_id=owner.id, name="Once",
                               last_visit=date.today() - timedelta(days=40)))
    db_session.commit()
    first = mkt.run_triggers(db_session, owner)
    second = mkt.run_triggers(db_session, owner)  # same day → no new triggers
    assert len(first) >= 1
    assert second == []
    # Only one row persisted for the lapsed trigger.
    assert db_session.query(MarketingTrigger).filter(
        MarketingTrigger.user_id == owner.id,
        MarketingTrigger.trigger_type == "lapsed").count() == 1


def test_list_and_mark_trigger(client, db_session):
    token, owner = _restaurant(client, db_session, "mkt5@example.com")
    db_session.add(CRMCustomer(user_id=owner.id, name="Luca",
                               last_visit=date.today() - timedelta(days=50)))
    db_session.commit()
    listed = client.get("/api/restaurant/marketing/triggers", headers=auth_headers(token)).json()
    assert len(listed["triggers"]) >= 1
    tid = listed["triggers"][0]["id"]
    res = client.post(f"/api/restaurant/marketing/triggers/{tid}/sent", headers=auth_headers(token))
    assert res.status_code == 200
    # Now the suggested list no longer includes it.
    again = client.get("/api/restaurant/marketing/triggers", headers=auth_headers(token)).json()
    assert all(t["id"] != tid for t in again["triggers"])


def test_marketing_requires_restaurant(client):
    token, _ = register_user(client, email="mkt-consumer@example.com", account_type="consumer")
    assert client.get("/api/restaurant/marketing/triggers", headers=auth_headers(token)).status_code == 403
