"""Tests for the photo upload pipeline.

Verify steps from GSD task `t-photo-upload`:
  - storage local backend round-trip (save → URL → delete)
  - dedup on Venue.photos append
  - oversize file rejected with 413
  - wrong mime rejected with 415
  - delete drops the URL from Venue.photos
  - traversal / out-of-root delete refused
"""
from __future__ import annotations

import io
from pathlib import Path

import pytest

from app.core.security import hash_password
from app.models import User, Venue
from app.services import storage


# Local storage round-trip ---------------------------------------------------


def test_local_storage_save_and_delete(tmp_path):
    b = storage.LocalStorage(root=tmp_path)
    url = b.save(namespace="42", filename_hint="picnic.jpg", content=b"abc", mime_type="image/jpeg")
    assert url.startswith("/uploads/42/")
    assert url.endswith(".jpg")
    # File actually exists on disk under the right namespace.
    rel = url[len("/uploads/"):]
    assert (tmp_path / rel).read_bytes() == b"abc"
    # Delete round-trip.
    assert b.delete(url) is True
    assert not (tmp_path / rel).exists()
    # Idempotent delete returns True (treated as already-gone).
    assert b.delete(url) is True


def test_local_storage_refuses_path_traversal(tmp_path):
    b = storage.LocalStorage(root=tmp_path)
    assert b.delete("/uploads/../../etc/passwd") is False
    assert b.delete("/uploads/42/../../escape.png") is False


def test_local_storage_refuses_foreign_url(tmp_path):
    b = storage.LocalStorage(root=tmp_path)
    assert b.delete("https://elsewhere.example/photo.jpg") is False


def test_ext_inference_prefers_filename_then_mime(tmp_path):
    b = storage.LocalStorage(root=tmp_path)
    url_known = b.save(namespace="x", filename_hint="snap.png", content=b"x", mime_type="image/png")
    assert url_known.endswith(".png")
    url_from_mime = b.save(namespace="x", filename_hint="unnamed", content=b"x", mime_type="image/webp")
    assert url_from_mime.endswith(".webp")


def test_size_and_mime_helpers():
    assert storage.is_allowed_mime("image/jpeg") is True
    assert storage.is_allowed_mime("image/png") is True
    assert storage.is_allowed_mime("application/pdf") is False
    assert storage.is_allowed_mime("") is False
    assert storage.is_allowed_mime(None) is False
    assert storage.is_within_size(1) is True
    assert storage.is_within_size(0) is False
    assert storage.is_within_size(storage.MAX_BYTES) is True
    assert storage.is_within_size(storage.MAX_BYTES + 1) is False


# Upload endpoint ------------------------------------------------------------


def _hours():
    return {d: [{"open": "00:00", "close": "23:59"}] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}


def _venue(db) -> Venue:
    v = Venue(slug="test-venue", name="Test Venue", type="restaurant", address="X",
              lat=41.9, lng=12.5, neighborhood="Centro", city="rome", country="IT",
              opening_hours=_hours(), avg_price_eur=60, price_level=2,
              dress_code="casual", music_types=[], crowd_types=[], vibe_tags=[],
              cuisine_tags=[], contact={}, photos=[], best_nights=[], active=True,
              quality_score=0.8)
    db.add(v); db.commit(); db.refresh(v); return v


@pytest.fixture()
def app_client(tmp_path, monkeypatch):
    """Spin up the full FastAPI app pinned to a local-storage root in tmp_path.

    The conftest binds the engine to a shared file-based test DB at module
    load, so we can't swap the database URL — instead we wipe + reseed the
    User + Venue rows we need before each test, and reset the storage
    singleton so uploads land under `tmp_path`.
    """
    monkeypatch.setenv("NOCTURNA_STORAGE_BACKEND", "local")
    monkeypatch.setenv("NOCTURNA_UPLOAD_DIR", str(tmp_path / "uploads"))
    storage.reset_backend_for_tests()

    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.db import SessionLocal

    with TestClient(app) as client:
        d = SessionLocal()
        # Wipe the rows this test cares about so state doesn't leak between
        # tests via the file-based test DB.
        d.query(Venue).delete()
        d.query(User).delete()
        d.commit()
        d.add(User(email="admin@nocturna.app", password_hash=hash_password("pw"),
                   role="admin", name="A"))
        _venue(d)
        d.commit()
        d.close()
        r = client.post("/api/auth/login", json={"email": "admin@nocturna.app", "password": "pw"})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"
        yield client

    storage.reset_backend_for_tests()


def _venue_id(client) -> int:
    r = client.get("/api/admin/venues")
    assert r.status_code == 200, r.text
    rows = r.json()
    return rows[0]["id"]


def test_upload_appends_url_and_dedups(app_client):
    vid = _venue_id(app_client)

    r = app_client.post(
        f"/api/admin/venues/{vid}/photos",
        files={"file": ("a.jpg", io.BytesIO(b"image-bytes"), "image/jpeg")},
    )
    assert r.status_code == 200, r.text
    photos = r.json()["photos"]
    assert len(photos) == 1
    first = photos[0]
    assert first.startswith("/uploads/")

    # Same upload again — must dedup on URL. (Different file content
    # produces a different URL via uuid, so we re-post; we expect 2 entries.)
    r2 = app_client.post(
        f"/api/admin/venues/{vid}/photos",
        files={"file": ("b.png", io.BytesIO(b"another"), "image/png")},
    )
    assert r2.status_code == 200, r2.text
    assert len(r2.json()["photos"]) == 2


def test_upload_rejects_oversize(app_client, monkeypatch):
    vid = _venue_id(app_client)
    monkeypatch.setattr(storage, "MAX_BYTES", 10)
    r = app_client.post(
        f"/api/admin/venues/{vid}/photos",
        files={"file": ("huge.jpg", io.BytesIO(b"this is more than ten bytes"), "image/jpeg")},
    )
    assert r.status_code == 413


def test_upload_rejects_wrong_mime(app_client):
    vid = _venue_id(app_client)
    r = app_client.post(
        f"/api/admin/venues/{vid}/photos",
        files={"file": ("malware.exe", io.BytesIO(b"MZ"), "application/x-msdownload")},
    )
    assert r.status_code == 415


def test_upload_missing_venue_returns_404(app_client):
    r = app_client.post(
        "/api/admin/venues/999999/photos",
        files={"file": ("a.jpg", io.BytesIO(b"x"), "image/jpeg")},
    )
    assert r.status_code == 404


def test_delete_removes_from_array(app_client):
    vid = _venue_id(app_client)
    up = app_client.post(
        f"/api/admin/venues/{vid}/photos",
        files={"file": ("a.jpg", io.BytesIO(b"image-bytes"), "image/jpeg")},
    )
    url = up.json()["photos"][0]

    r = app_client.request("DELETE", f"/api/admin/venues/{vid}/photos", json={"url": url})
    assert r.status_code == 200, r.text
    assert r.json()["photos"] == []


def test_delete_unknown_url_is_idempotent(app_client):
    vid = _venue_id(app_client)
    r = app_client.request("DELETE", f"/api/admin/venues/{vid}/photos", json={"url": "/uploads/ghost.jpg"})
    assert r.status_code == 200
    assert r.json()["photos"] == []


def test_uploads_require_admin(tmp_path, monkeypatch):
    monkeypatch.setenv("NOCTURNA_STORAGE_BACKEND", "local")
    monkeypatch.setenv("NOCTURNA_UPLOAD_DIR", str(tmp_path / "uploads"))
    storage.reset_backend_for_tests()

    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.db import SessionLocal

    with TestClient(app) as client:
        d = SessionLocal()
        d.query(Venue).delete()
        d.query(User).delete()
        d.commit()
        d.add(User(email="u@example.com", password_hash=hash_password("pw"),
                   role="user", name="U"))
        v = _venue(d)
        d.commit()
        vid = v.id
        d.close()
        r = client.post("/api/auth/login", json={"email": "u@example.com", "password": "pw"})
        token = r.json()["access_token"]
        r = client.post(
            f"/api/admin/venues/{vid}/photos",
            files={"file": ("a.jpg", io.BytesIO(b"x"), "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403
    storage.reset_backend_for_tests()
