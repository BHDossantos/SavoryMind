import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.api.routes.payments import CheckoutIn, checkout, mock_confirm
from app.core.config import Settings, get_settings
from app.models import User, Payment
from app.services import payments as pay


@pytest.fixture()
def buyer(db):
    user = User(email="buyer@guard.test", password_hash="x", role="user")
    db.add(user)
    db.commit()
    return user


@pytest.mark.parametrize("amount", [0, -1, 0.01, 9.99])
def test_client_cannot_override_price(db, buyer, amount):
    with pytest.raises(HTTPException) as exc:
        checkout(CheckoutIn(purpose="subscription_user", amount_eur=amount), db, buyer)
    assert exc.value.status_code == 400
    assert db.query(Payment).count() == 0


def test_unknown_purpose_rejected(db, buyer):
    with pytest.raises(HTTPException) as exc:
        checkout(CheckoutIn(purpose="custom"), db, buyer)
    assert exc.value.status_code == 400


def test_checkout_uses_catalog_price(db, buyer, monkeypatch):
    monkeypatch.setattr(pay, "_stripe", None)
    result = checkout(CheckoutIn(purpose="subscription_user"), db, buyer)
    assert db.get(Payment, result["payment_id"]).amount_eur == 9.99


def test_production_missing_stripe_cannot_grant_mock_access(db, buyer, monkeypatch):
    monkeypatch.setattr(pay, "_stripe", None)
    monkeypatch.setattr(get_settings(), "APP_ENV", "production")
    with pytest.raises(HTTPException) as exc:
        checkout(CheckoutIn(purpose="subscription_user"), db, buyer)
    assert exc.value.status_code == 503
    with pytest.raises(HTTPException) as exc:
        mock_confirm(1, db, buyer)
    assert exc.value.status_code == 404
    assert db.query(Payment).count() == 0


def test_mock_confirmation_cannot_target_another_user(db, buyer, monkeypatch):
    monkeypatch.setattr(pay, "_stripe", None)
    payment = Payment(user_id=buyer.id + 1, purpose="subscription_user", amount_eur=9.99)
    db.add(payment); db.commit()
    with pytest.raises(HTTPException) as exc:
        mock_confirm(payment.id, db, buyer)
    assert exc.value.status_code == 404
    assert payment.status != "succeeded"


def test_missing_linked_plan_rejected(db, buyer):
    with pytest.raises(HTTPException) as exc:
        checkout(CheckoutIn(purpose="instant_plan", plan_id=999), db, buyer)
    assert exc.value.status_code == 404


def test_regular_user_cannot_buy_venue_subscription(db, buyer):
    with pytest.raises(HTTPException) as exc:
        checkout(CheckoutIn(purpose="subscription_venue_basic"), db, buyer)
    assert exc.value.status_code == 403


def test_production_rejects_default_secrets():
    with pytest.raises(ValidationError):
        Settings(APP_ENV="production", _env_file=None)
    with pytest.raises(ValidationError):
        Settings(APP_ENV="production", SECRET_KEY="a" * 32, SEED_ON_STARTUP=True, _env_file=None)
    assert Settings(APP_ENV="production", SECRET_KEY="a" * 32,
                    SEED_ON_STARTUP=False, _env_file=None)
