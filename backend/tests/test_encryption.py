"""EncryptedText TypeDecorator regression suite (commit 76343a5).

Verifies tokens are not stored plaintext, decrypt cleanly on read,
fail gracefully on tampered ciphertext, and tolerate legacy plaintext
left over from before encryption shipped.
"""
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from .conftest import register_user


def _db_file(client):
    """Pull the SQLite path the TestClient is using out of the engine URL."""
    from app.core.database import engine
    url = str(engine.url)
    # Format: sqlite:////tmp/sm-tests-XXX/test.db
    assert url.startswith("sqlite:///")
    return Path(url.removeprefix("sqlite:///"))


def test_tokens_are_ciphertext_on_disk(client, db_session):
    register_user(client)
    from app.models.consumer import SocialConnection

    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.connected = True
    conn.access_token = "plaintext_secret_value_xyz"
    conn.refresh_token = "plaintext_refresh_value_abc"
    conn.token_expires_at = datetime.utcnow() + timedelta(hours=1)
    db_session.commit()

    raw = sqlite3.connect(_db_file(client))
    row = raw.execute(
        "SELECT access_token, refresh_token FROM social_connections WHERE user_id=1 AND platform='spotify'"
    ).fetchone()
    raw.close()

    assert row[0] is not None and "plaintext_secret_value_xyz" not in row[0]
    assert row[1] is not None and "plaintext_refresh_value_abc" not in row[1]
    # Fernet ciphertext starts with a fixed magic prefix — sanity-check
    # we're storing a real Fernet token, not just base64 of plaintext.
    assert row[0].startswith("gAAAAA")
    assert row[1].startswith("gAAAAA")


def test_round_trip_decrypt(client, db_session):
    register_user(client)
    from app.models.consumer import SocialConnection

    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.access_token = "the original value"
    conn.refresh_token = "another value"
    db_session.commit()

    db_session.expire_all()
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    assert conn.access_token == "the original value"
    assert conn.refresh_token == "another value"


def test_tampered_ciphertext_returns_none(client, db_session):
    register_user(client)
    from app.models.consumer import SocialConnection

    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.access_token = "good_token"
    conn.refresh_token = "good_refresh"
    db_session.commit()

    # Corrupt the access_token ciphertext directly in the DB
    raw = sqlite3.connect(_db_file(client))
    raw.execute(
        "UPDATE social_connections SET access_token='corrupted_garbage' WHERE user_id=1 AND platform='spotify'"
    )
    raw.commit()
    raw.close()

    db_session.expire_all()
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    assert conn.access_token is None  # graceful degradation, not exception
    # Sibling column still decrypts
    assert conn.refresh_token == "good_refresh"


def test_legacy_plaintext_returns_none(client, db_session):
    """Pre-encryption rows from before this PR landed in prod must not
    crash the app — they decode to None and the user gets prompted to
    reconnect."""
    register_user(client)

    raw = sqlite3.connect(_db_file(client))
    # Insert a plaintext value (simulating a row written before encryption shipped)
    raw.execute(
        "UPDATE social_connections SET access_token='legacy_plaintext_token' "
        "WHERE user_id=1 AND platform='spotify'"
    )
    raw.commit()
    raw.close()

    from app.models.consumer import SocialConnection

    db_session.expire_all()
    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    assert conn.access_token is None


def test_null_passes_through(client, db_session):
    """Setting None must not be encrypted (the column is nullable)."""
    register_user(client)
    from app.models.consumer import SocialConnection

    conn = db_session.query(SocialConnection).filter_by(user_id=1, platform="spotify").first()
    conn.access_token = None
    db_session.commit()

    raw = sqlite3.connect(_db_file(client))
    row = raw.execute(
        "SELECT access_token FROM social_connections WHERE user_id=1 AND platform='spotify'"
    ).fetchone()
    raw.close()
    assert row[0] is None
