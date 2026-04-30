"""Shared pytest fixtures.

Goals:
  - Each test gets a fresh SQLite DB so order doesn't matter.
  - Spotify env vars are pre-set so /oauth/spotify endpoints don't
    short-circuit to 503.
  - Cookies actually round-trip in TestClient — Fernet-secure cookies
    set by FastAPI need COOKIE_SECURE=false because httpx's test
    transport reports the request as plain http.
  - Lifespan runs (so Alembic upgrades the schema) before the first
    request — TestClient does this automatically when used as a
    context manager.

Env vars are written into os.environ *before* the app or settings module
gets imported. Pydantic-settings reads them at instantiation time, and
that happens on first import of `app.core.config`, so any test that
imports the app must run after these are set. Using `pytest_configure`
guarantees that.
"""
import os
import tempfile
from pathlib import Path

import pytest


def pytest_configure(config):
    """Run once before any test module imports the app."""
    # Per-session isolated SQLite DB. Tests run alembic upgrade head
    # against this on lifespan startup.
    db_dir = Path(tempfile.mkdtemp(prefix="sm-tests-"))
    db_path = db_dir / "test.db"

    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path}")
    os.environ.setdefault("COOKIE_SECURE", "false")
    os.environ.setdefault("SPOTIFY_CLIENT_ID", "test_client_id")
    os.environ.setdefault("SPOTIFY_CLIENT_SECRET", "test_client_secret")
    os.environ.setdefault("SPOTIFY_REDIRECT_URI", "http://testserver/api/oauth/spotify/callback")
    os.environ.setdefault("FRONTEND_URL", "http://testserver")
    # Use the dev-default Fernet key for tests — same key the dev DB uses,
    # so encryption tests are deterministic.
    os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "6oyaUCTF-qMyyC0mzvOkaXwmrt5RhYV_ZfIeiuRcXcI=")

    # Stash the path so the per-test fixture can wipe it cleanly.
    config._sm_db_path = db_path


@pytest.fixture
def client(request):
    """A FastAPI TestClient against a *fresh* SQLite DB.

    The DB file is recreated per-test by deleting it before the test
    runs and letting Alembic re-create it via lifespan. Slower than
    sharing a DB and truncating between tests, but bullet-proof against
    test interactions and cheap enough for ~50 tests.
    """
    # Defer imports until env vars are set (see pytest_configure above).
    from fastapi.testclient import TestClient
    from main import app

    db_path = request.config._sm_db_path

    # Dispose any pool from a previous test that's still holding open
    # connections to the (about to be deleted) DB file. Without this,
    # the engine hands out cached connections to the deleted inode and
    # the next test sees the previous test's rows.
    from app.core.database import engine
    engine.dispose()

    if db_path.exists():
        db_path.unlink()

    # Disable rate limiting for tests. The /register endpoint is capped
    # at 5/minute in production, which would 429 the 6th-onwards test
    # in any module that uses register_user. We keep the limiter
    # *attached* (so the @limiter.limit decorator still resolves) but
    # turn enforcement off.
    from app.core.rate_limit import limiter
    limiter.enabled = False
    limiter.reset()

    with TestClient(app) as c:
        yield c

    # Clean shutdown so the next test's dispose() works against a quiet pool.
    engine.dispose()


@pytest.fixture
def db_session(client):
    """A SQLAlchemy session on the same DB the TestClient is using.
    Useful for tests that need to read/write rows directly to set up
    state or assert on side effects."""
    from app.core.database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---- Convenience helpers -------------------------------------------------


def register_user(client, email="alice@example.com", account_type="consumer"):
    """Register a user and return (access_token, user_dict). Refresh
    cookie is in the client's jar after this returns."""
    r = client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "display_name": "Alice",
        "account_type": account_type,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    return body["access_token"], body["user"]


def auth_headers(access_token):
    return {"Authorization": f"Bearer {access_token}"}
