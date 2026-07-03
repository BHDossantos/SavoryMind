"""Tests for native push notifications."""
from unittest.mock import patch

from app.models.user import User
from app.services import push_service, notification_service

from .conftest import register_user, auth_headers


def test_send_noop_without_token():
    assert push_service.send(None, "Hi", "Body") is False
    assert push_service.send("", "Hi", "Body") is False
    assert push_service.send("not-a-token", "Hi", "Body") is False


def test_token_validation():
    assert push_service._looks_like_expo_token("ExponentPushToken[abc]") is True
    assert push_service._looks_like_expo_token("ExpoPushToken[abc]") is True
    assert push_service._looks_like_expo_token("random") is False


def test_send_to_user_uses_stored_token(db_session):
    u = User(email="pushu@example.com", password_hash="x", display_name="P",
             account_type="consumer", expo_push_token="ExponentPushToken[xyz]")
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    with patch("app.services.push_service.send", return_value=True) as send:
        ok = push_service.send_to_user(db_session, u.id, "T", "B")
    assert ok is True
    assert send.called


def test_send_to_user_noop_without_token(db_session):
    u = User(email="pushu2@example.com", password_hash="x", display_name="P",
             account_type="consumer")
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    assert push_service.send_to_user(db_session, u.id, "T", "B") is False


def test_register_token_endpoint(client, db_session):
    token, user = register_user(client, email="pushep@example.com", account_type="consumer")
    res = client.post("/api/auth/push-token", headers=auth_headers(token),
                      json={"token": "ExponentPushToken[device1]"})
    assert res.status_code == 204
    u = db_session.query(User).filter(User.id == user["id"]).first()
    assert u.expo_push_token == "ExponentPushToken[device1]"


def test_register_empty_token_clears(client, db_session):
    token, user = register_user(client, email="pushep2@example.com", account_type="consumer")
    client.post("/api/auth/push-token", headers=auth_headers(token),
                json={"token": "ExponentPushToken[d]"})
    client.post("/api/auth/push-token", headers=auth_headers(token), json={"token": ""})
    u = db_session.query(User).filter(User.id == user["id"]).first()
    assert u.expo_push_token is None


def test_notification_create_also_pushes(db_session):
    """notification_service.create fires a best-effort push when the user
    has a token — but a push failure never breaks the in-app row."""
    u = User(email="pushnotif@example.com", password_hash="x", display_name="P",
             account_type="restaurant", expo_push_token="ExponentPushToken[z]")
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    with patch("app.services.push_service.send", return_value=True) as send:
        notification_service.create(db_session, u.id, "New booking!", link="/x")
        db_session.commit()
    assert send.called


def test_notification_create_survives_push_failure(db_session):
    u = User(email="pushfail@example.com", password_hash="x", display_name="P",
             account_type="restaurant", expo_push_token="ExponentPushToken[z]")
    db_session.add(u); db_session.commit(); db_session.refresh(u)
    from app.models.notification import Notification
    with patch("app.services.push_service.send", side_effect=Exception("boom")):
        notification_service.create(db_session, u.id, "Still logged", link=None)
        db_session.commit()
    assert db_session.query(Notification).filter(Notification.user_id == u.id).count() == 1
