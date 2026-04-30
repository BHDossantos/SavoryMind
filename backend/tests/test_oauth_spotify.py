"""Spotify OAuth flow regression suite.

Covers the Authorization Code flow + token-refresh wrapper + search
endpoint introduced in commits a9ed173 and af3a986.
"""
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest

from .conftest import register_user, auth_headers


# ---- /spotify/start ------------------------------------------------------


def test_start_returns_authorize_url_with_state(client):
    access, _ = register_user(client)
    r = client.get("/api/oauth/spotify/start", headers=auth_headers(access))
    assert r.status_code == 200
    url = r.json()["authorize_url"]
    parsed = urlparse(url)
    assert parsed.netloc == "accounts.spotify.com"
    qs = parse_qs(parsed.query)
    assert qs["client_id"] == ["test_client_id"]
    assert qs["response_type"] == ["code"]
    assert qs["redirect_uri"] == ["http://testserver/api/oauth/spotify/callback"]
    assert qs.get("state") and qs["state"][0]


def test_start_requires_auth(client):
    r = client.get("/api/oauth/spotify/start")
    assert r.status_code == 401


def test_start_returns_503_when_unconfigured(monkeypatch, client):
    # Simulate a server with Spotify env vars unset
    from app.core.config import settings

    monkeypatch.setattr(settings, "spotify_client_id", "")
    access, _ = register_user(client)
    r = client.get("/api/oauth/spotify/start", headers=auth_headers(access))
    assert r.status_code == 503
    assert "not configured" in r.json()["detail"]


# ---- state JWT signing/verification --------------------------------------


def test_state_jwt_round_trip():
    from app.services.spotify_service import _sign_state, verify_state, STATE_TYPE

    state = _sign_state(user_id=42)
    assert verify_state(state) == 42


def test_state_jwt_tampered_signature_rejected():
    from app.services.spotify_service import _sign_state, verify_state

    state = _sign_state(user_id=42)
    tampered = state[:-3] + "xxx"
    with pytest.raises(ValueError):
        verify_state(tampered)


def test_state_jwt_wrong_typ_rejected():
    """A regular access token must not be accepted as a Spotify OAuth
    state — the typ claim guard blocks misuse across token types."""
    from app.core.security import create_access_token
    from app.services.spotify_service import verify_state

    access_jwt = create_access_token(42, "alice@example.com")
    with pytest.raises(ValueError):
        verify_state(access_jwt)


# ---- /spotify/callback ---------------------------------------------------


def test_callback_with_error_redirects(client):
    r = client.get("/api/oauth/spotify/callback?error=access_denied", follow_redirects=False)
    assert r.status_code == 302
    assert "spotify=error" in r.headers["location"]
    assert "access_denied" in r.headers["location"]


def test_callback_with_missing_params_redirects(client):
    r = client.get("/api/oauth/spotify/callback", follow_redirects=False)
    assert r.status_code == 302
    assert "spotify=error" in r.headers["location"]


def test_callback_with_garbage_state_redirects(client):
    r = client.get("/api/oauth/spotify/callback?code=xyz&state=notajwt", follow_redirects=False)
    assert r.status_code == 302
    assert "bad_state" in r.headers["location"]


# ---- /spotify/search -----------------------------------------------------


def test_search_when_not_connected_returns_409(client):
    access, _ = register_user(client)
    r = client.post(
        "/api/oauth/spotify/search",
        headers=auth_headers(access),
        json={"query": "jazz"},
    )
    assert r.status_code == 409


def test_search_with_empty_query_returns_400(client, db_session):
    access, _ = register_user(client)
    # Mark Spotify connected with a fake (still-fresh) token
    from app.models.consumer import SocialConnection
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.connected = True
    conn.access_token = "stub"
    conn.refresh_token = "stub_refresh"
    conn.token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db_session.commit()

    r = client.post(
        "/api/oauth/spotify/search",
        headers=auth_headers(access),
        json={"query": "   "},
    )
    assert r.status_code == 400


def test_search_requires_auth(client):
    r = client.post("/api/oauth/spotify/search", json={"query": "jazz"})
    assert r.status_code == 401


# ---- /spotify/disconnect -------------------------------------------------


def test_disconnect_when_no_connection_returns_204(client):
    access, _ = register_user(client)
    r = client.post("/api/oauth/spotify/disconnect", headers=auth_headers(access))
    assert r.status_code == 204


def test_disconnect_clears_stored_tokens(client, db_session):
    access, _ = register_user(client)
    from app.models.consumer import SocialConnection
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.connected = True
    conn.access_token = "secret_access"
    conn.refresh_token = "secret_refresh"
    conn.token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db_session.commit()

    r = client.post("/api/oauth/spotify/disconnect", headers=auth_headers(access))
    assert r.status_code == 204

    db_session.expire_all()
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    assert conn.connected is False
    assert conn.access_token is None
    assert conn.refresh_token is None


def test_disconnect_requires_auth(client):
    r = client.post("/api/oauth/spotify/disconnect")
    assert r.status_code == 401


# ---- token-refresh wrapper -----------------------------------------------


def test_get_fresh_access_token_passthrough_when_fresh(client, db_session):
    """If the stored token has plenty of life left, no refresh call is
    made — the same token is returned."""
    register_user(client)
    from app.models.consumer import SocialConnection
    from app.services.spotify_service import get_fresh_access_token

    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.connected = True
    conn.access_token = "still_fresh"
    conn.refresh_token = "refresh"
    conn.token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db_session.commit()

    assert get_fresh_access_token(db_session, conn) == "still_fresh"


def test_get_fresh_access_token_marks_disconnected_when_no_refresh(client, db_session):
    """An expired token with no refresh_token cannot be saved — mark the
    row disconnected and raise so the route returns 401."""
    register_user(client)
    from app.models.consumer import SocialConnection
    from app.services.spotify_service import get_fresh_access_token, SpotifyAuthError

    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.connected = True
    conn.access_token = "expired"
    conn.refresh_token = None  # cannot refresh
    conn.token_expires_at = datetime.utcnow() - timedelta(minutes=1)
    db_session.commit()

    with pytest.raises(SpotifyAuthError):
        get_fresh_access_token(db_session, conn)

    db_session.expire_all()
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    assert conn.connected is False
