"""Shared fixtures: fresh in-memory SQLite per test + API client + factories."""
from __future__ import annotations

from datetime import datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app
from app import models  # noqa: F401  (register tables)


@pytest.fixture()
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s


@pytest.fixture()
def client(engine):
    def _get_session_override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _get_session_override
    # Plain TestClient (no context manager) so startup hooks — and with them
    # the APScheduler tick — never fire during tests.
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── API-level factories ────────────────────────────────────────────────────


def signup(client, email: str, role: str = "customer", first_name: str = "Test") -> dict:
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": "password123", "first_name": first_name, "role": role},
    )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make_provider(
    client,
    session,
    email: str = "barber@test.io",
    category: str = "barber",
    city: str = "Rome",
    *,
    approved: bool = True,
    deposit_cents: int = 0,
) -> dict:
    """Create a provider with one service and all-week 9-19 availability.

    Returns {"headers", "provider_id", "service_id"}.
    """
    headers = signup(client, email, role="provider")
    r = client.post(
        "/providers/me",
        headers=headers,
        json={"display_name": f"Shop {email}", "category": category, "city": city},
    )
    assert r.status_code == 200, r.text
    provider_id = r.json()["id"]

    if approved:
        provider = session.get(models.Provider, provider_id)
        provider.approval_status = models.ApprovalStatus.approved
        session.add(provider)
        session.commit()

    r = client.post(
        "/services",
        headers=headers,
        json={
            "name": "Cut",
            "duration_minutes": 30,
            "price_cents": 2500,
            "deposit_required": deposit_cents > 0,
            "deposit_amount_cents": deposit_cents,
        },
    )
    assert r.status_code == 200, r.text
    service_id = r.json()["id"]

    r = client.put(
        "/availability/mine",
        headers=headers,
        json=[
            {"day_of_week": d, "start_time": "09:00:00", "end_time": "19:00:00"}
            for d in range(7)
        ],
    )
    assert r.status_code == 200, r.text

    return {"headers": headers, "provider_id": provider_id, "service_id": service_id}


def tomorrow_at(hour: int, minute: int = 0) -> str:
    d = datetime.utcnow().date() + timedelta(days=1)
    return datetime.combine(d, time(hour, minute)).isoformat()


def days_ahead_at(days: int, hour: int, minute: int = 0) -> str:
    """A start time far enough out that no reminder is due at booking time."""
    d = datetime.utcnow().date() + timedelta(days=days)
    return datetime.combine(d, time(hour, minute)).isoformat()
