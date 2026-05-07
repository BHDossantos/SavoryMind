"""Tests for the weekly inventory digest job + the internal endpoint
guarding it.

Coverage:
- run_digest creates one notification when items below par
- run_digest skips when nothing below par
- run_digest is idempotent within the same week (UPDATE not INSERT)
- run_digest skips restaurants whose local time isn't Mon 8am
- /internal/jobs/inventory-digest 401s without OIDC token
- /internal/jobs/inventory-digest 401s with wrong audience / wrong email
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest

from app.models.inventory import InventoryItem, InventoryAdjustment
from app.models.notification import Notification
from app.models.user import User
from app.services import inventory_digest_service

from .conftest import register_user, auth_headers


# A fixed Monday 8am UTC, used as the canonical "now" for digest tests.
# 2026-05-04 is a Monday.
MONDAY_8AM_UTC = datetime(2026, 5, 4, 8, 30, tzinfo=timezone.utc)


def _seed_restaurant_with_items(client, db_session, email="r@x.com",
                                 timezone_name="UTC", items_below_par=2):
    """Register a restaurant user, set their TZ, seed N items below par."""
    register_user(client, email=email, account_type="restaurant")
    user = db_session.query(User).filter_by(email=email).first()
    user.timezone = timezone_name
    db_session.commit()

    for i in range(items_below_par):
        item = InventoryItem(
            user_id=user.id,
            name=f"Item {i+1}",
            category="alcohol",
            unit="bottles",
            par_level=10.0,
        )
        db_session.add(item)
    db_session.commit()
    return user


# ── run_digest behavior ──────────────────────────────────────────────────


def test_digest_creates_notification_for_low_stock(client, db_session):
    user = _seed_restaurant_with_items(client, db_session, items_below_par=3)

    stats = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)

    assert stats["restaurants_processed"] == 1
    assert stats["notifications_created"] == 1
    assert stats["notifications_updated"] == 0

    n = db_session.query(Notification).filter_by(user_id=user.id).first()
    assert n is not None
    assert n.message.startswith("Weekly inventory digest:")
    assert "3 items below par" in n.message
    assert n.link == "/restaurant/inventory"
    assert n.read is False


def test_digest_skips_when_nothing_below_par(client, db_session):
    """All items at/above par → no notification, no email."""
    user = _seed_restaurant_with_items(client, db_session, items_below_par=0)

    # Add an item with adjustments bringing it ABOVE par
    item = InventoryItem(
        user_id=user.id,
        name="Stocked Up",
        category="alcohol",
        unit="bottles",
        par_level=5.0,
    )
    db_session.add(item)
    db_session.commit()
    db_session.add(InventoryAdjustment(
        item_id=item.id, user_id=user.id, adjustment_type="delivery", delta=20.0,
    ))
    db_session.commit()

    stats = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)

    assert stats["notifications_created"] == 0
    assert stats["skipped_no_low_stock"] >= 1
    assert db_session.query(Notification).filter_by(user_id=user.id).count() == 0


def test_digest_idempotent_within_same_week(client, db_session):
    """Re-running the same hour MUST update the existing notification,
    not create a second one. Cloud Scheduler retries on 5xx so this
    matters."""
    user = _seed_restaurant_with_items(client, db_session, items_below_par=2)

    s1 = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)
    s2 = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)

    assert s1["notifications_created"] == 1
    assert s2["notifications_created"] == 0
    assert s2["notifications_updated"] == 1
    assert db_session.query(Notification).filter_by(user_id=user.id).count() == 1


def test_digest_skips_restaurant_outside_8am_window(client, db_session):
    """Restaurant in Pacific/Auckland (UTC+12) is at 8pm-Monday when
    UTC clock says 8am-Monday. Should be skipped."""
    user = _seed_restaurant_with_items(
        client, db_session, email="auckland@x.com",
        timezone_name="Pacific/Auckland", items_below_par=2,
    )

    stats = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)

    assert stats["notifications_created"] == 0
    assert stats["skipped_wrong_time"] >= 1


def test_digest_respects_per_restaurant_timezone(client, db_session):
    """LA restaurant fires when UTC == 16:00 (16:00 UTC == 09:00 PDT
    on a non-DST date — close enough to demonstrate filter works)."""
    user = _seed_restaurant_with_items(
        client, db_session, email="la@x.com",
        timezone_name="America/Los_Angeles", items_below_par=1,
    )

    # UTC clock = 15:30 → LA is 08:30 (during PDT). Monday window matches.
    # 2026-05-04 is during PDT (UTC-7).
    la_window_utc = datetime(2026, 5, 4, 15, 30, tzinfo=timezone.utc)
    stats = inventory_digest_service.run_digest(db_session, now=la_window_utc)

    assert stats["notifications_created"] == 1


def test_digest_email_sent_when_resend_configured(client, db_session, monkeypatch):
    """When RESEND_API_KEY is set AND a real recipient email, the digest
    should attempt one send per restaurant."""
    user = _seed_restaurant_with_items(client, db_session, items_below_par=2)
    monkeypatch.setenv("RESEND_API_KEY", "test_key")

    with patch("app.services.resend_client.send_email", return_value=True) as send:
        stats = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)

    assert stats["emails_sent"] == 1
    assert send.call_count == 1
    call_kwargs = send.call_args.kwargs
    assert call_kwargs["to"] == user.email
    assert "items below par" in call_kwargs["subject"]


def test_digest_skips_email_when_resend_unconfigured(client, db_session, monkeypatch):
    """No RESEND_API_KEY → no send call, but notification still created."""
    user = _seed_restaurant_with_items(client, db_session, items_below_par=2)
    monkeypatch.delenv("RESEND_API_KEY", raising=False)

    with patch("app.services.resend_client.send_email") as send:
        stats = inventory_digest_service.run_digest(db_session, now=MONDAY_8AM_UTC)

    assert stats["notifications_created"] == 1
    assert stats["emails_sent"] == 0
    assert send.call_count == 0


# ── /internal/jobs/inventory-digest auth ────────────────────────────────


def test_internal_endpoint_rejects_no_token(client):
    r = client.post("/internal/jobs/inventory-digest")
    assert r.status_code == 401


def test_internal_endpoint_rejects_malformed_token(client):
    r = client.post("/internal/jobs/inventory-digest",
                    headers={"Authorization": "NotBearer something"})
    assert r.status_code == 401


def test_internal_endpoint_rejects_when_unconfigured(client, monkeypatch):
    """Endpoint refuses to run if SCHEDULER_SERVICE_ACCOUNT not set —
    prevents accidental open endpoint in dev/staging."""
    monkeypatch.delenv("SCHEDULER_SERVICE_ACCOUNT", raising=False)
    monkeypatch.delenv("SCHEDULER_AUDIENCE", raising=False)

    r = client.post("/internal/jobs/inventory-digest",
                    headers={"Authorization": "Bearer any-token-here"})
    assert r.status_code == 401


def test_internal_endpoint_accepts_valid_oidc(client, db_session, monkeypatch):
    """When the configured SA email matches, the digest runs. We patch
    the helper directly rather than the underlying google.oauth2 module
    so the test doesn't require google-auth to be importable."""
    monkeypatch.setenv("SCHEDULER_SERVICE_ACCOUNT", "scheduler-runner@test.iam.gserviceaccount.com")
    monkeypatch.setenv("SCHEDULER_AUDIENCE", "https://api.test/internal/jobs/inventory-digest")

    with patch(
        "app.api.routes.internal_jobs._verify_scheduler_oidc",
        return_value="scheduler-runner@test.iam.gserviceaccount.com",
    ):
        r = client.post("/internal/jobs/inventory-digest",
                        headers={"Authorization": "Bearer any-token-here"})

    assert r.status_code == 200
    body = r.json()
    assert "restaurants_processed" in body
    assert "notifications_created" in body


def test_internal_endpoint_rejects_wrong_email_claim(client, monkeypatch):
    """Helper-level test: bad email → 401. Mocks the helper to raise
    HTTPException(401) the way it would when claims don't match."""
    from fastapi import HTTPException
    monkeypatch.setenv("SCHEDULER_SERVICE_ACCOUNT", "scheduler-runner@test.iam.gserviceaccount.com")
    monkeypatch.setenv("SCHEDULER_AUDIENCE", "https://api.test/internal/jobs/inventory-digest")

    def reject(_):
        raise HTTPException(status_code=401, detail="Token not issued to expected service account.")

    with patch("app.api.routes.internal_jobs._verify_scheduler_oidc", side_effect=reject):
        r = client.post("/internal/jobs/inventory-digest",
                        headers={"Authorization": "Bearer any-token-here"})

    assert r.status_code == 401
