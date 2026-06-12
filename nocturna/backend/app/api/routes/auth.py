import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut
from app.services import notifications, templates

log = logging.getLogger("nocturna.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


# 24h is long enough for users to come back tomorrow, short enough to stay safe.
VERIFY_TOKEN_TTL = timedelta(hours=24)


def _frontend_base_url() -> str:
    """Where the user lands when they click the verification link.

    Same env var Stripe success URLs use.
    """
    return os.getenv("NOCTURNA_APP_BASE_URL", "http://localhost:3001").rstrip("/")


def _send_verify_email(db: Session, user: User) -> str:
    """Generate a fresh token + send the verify email. Returns the token
    (so tests can assert on it without scraping the email log)."""
    token = secrets.token_urlsafe(32)
    user.email_verify_token = token
    user.email_verify_token_expires_at = datetime.utcnow() + VERIFY_TOKEN_TTL
    db.commit()
    db.refresh(user)

    verify_url = f"{_frontend_base_url()}/verify/{token}"
    subject, body = templates.email_verify(user.name, verify_url)
    try:
        notifications.send_email(db, user.email, subject, body, user_id=user.id)
    except Exception as e:  # pragma: no cover — defensive
        log.warning("could not send verify email to %s: %s", user.email, e)
    return token


@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        phone=data.phone,
        role="user",
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _send_verify_email(db, user)
    return TokenOut(
        access_token=create_access_token(str(user.id), role=user.role),
        user_id=user.id,
        email=user.email,
        role=user.role,
        name=user.name,
    )


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(
        access_token=create_access_token(str(user.id), role=user.role),
        user_id=user.id,
        email=user.email,
        role=user.role,
        name=user.name,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "phone": user.phone,
        "role": user.role,
        "lang": user.lang,
        "home_city": user.home_city,
        "prefs": user.prefs or {},
        "email_verified": bool(user.email_verified),
    }


@router.put("/me")
def update_me(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k in ("name", "phone", "lang", "home_city", "age_range", "gender"):
        if k in payload:
            setattr(user, k, payload[k])
    if "prefs" in payload and isinstance(payload["prefs"], dict):
        merged = {**(user.prefs or {}), **payload["prefs"]}
        user.prefs = merged
    db.commit()
    db.refresh(user)
    return {"ok": True}


# Email verification --------------------------------------------------------


@router.get("/verify/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    """Flip the user's email_verified flag if the token is valid + unexpired."""
    if not token:
        raise HTTPException(400, "Missing token")
    user = db.query(User).filter(User.email_verify_token == token).first()
    if not user:
        raise HTTPException(400, "Invalid or expired verification link")
    if user.email_verify_token_expires_at and user.email_verify_token_expires_at < datetime.utcnow():
        # Clear the stale token so it can't be re-used.
        user.email_verify_token = None
        user.email_verify_token_expires_at = None
        db.commit()
        raise HTTPException(400, "Invalid or expired verification link")
    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_token_expires_at = None
    db.commit()
    # Best-effort acknowledgement email — keeps the loop simple.
    try:
        subject, body = templates.email_verified_ack()
        notifications.send_email(db, user.email, subject, body, user_id=user.id)
    except Exception as e:  # pragma: no cover
        log.debug("verify ack email failed for %s: %s", user.email, e)
    return {"ok": True, "email": user.email}


@router.post("/resend-verification")
def resend_verification(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a fresh token + re-send the verification email."""
    if user.email_verified:
        return {"ok": True, "already_verified": True}
    _send_verify_email(db, user)
    return {"ok": True, "sent_to": user.email}