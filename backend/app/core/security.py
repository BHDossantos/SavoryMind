import hmac
import hashlib
import base64
import json
import os
import uuid
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db

bearer_scheme = HTTPBearer()

_ITERATIONS = 260_000

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return base64.b64encode(salt + key).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        raw = base64.b64decode(hashed.encode())
        salt, stored_key = raw[:16], raw[16:]
        key = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, _ITERATIONS)
        return hmac.compare_digest(key, stored_key)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (padding % 4))


def _create_token(user_id: int, email: str, token_type: str, expire: datetime) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    claims = {
        "sub": str(user_id),
        "email": email,
        "typ": token_type,
        "exp": int(expire.timestamp()),
    }
    if token_type == REFRESH_TOKEN_TYPE:
        # jti lets us add server-side revocation later without changing the
        # token shape. Right now it's purely opaque, but logged.
        claims["jti"] = uuid.uuid4().hex
    payload = _b64url_encode(json.dumps(claims).encode())
    signing_input = f"{header}.{payload}".encode()
    sig = hmac.new(settings.secret_key.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url_encode(sig)}"


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return _create_token(user_id, email, ACCESS_TOKEN_TYPE, expire)


def create_refresh_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    return _create_token(user_id, email, REFRESH_TOKEN_TYPE, expire)


def decode_token(token: str, expected_type: str) -> dict:
    """Decode and validate a JWT. Raises ValueError on any failure.

    expected_type guards against using a refresh token where an access token
    is required (and vice-versa) — a common JWT misuse.
    """
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        raise ValueError("Invalid token structure")

    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = hmac.new(settings.secret_key.encode(), signing_input, hashlib.sha256).digest()
    actual_sig = _b64url_decode(sig_b64)

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid signature")

    payload = json.loads(_b64url_decode(payload_b64))
    if payload.get("exp", 0) < datetime.utcnow().timestamp():
        raise ValueError("Token expired")

    # Tokens minted before the typ claim was added (legacy 30-day access
    # tokens) are treated as access tokens for backward compatibility during
    # the rollout. Once those naturally expire (≤30 days), this branch can be
    # removed.
    actual_type = payload.get("typ", ACCESS_TOKEN_TYPE)
    if actual_type != expected_type:
        raise ValueError(f"Wrong token type: expected {expected_type}")

    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    from ..models.user import User

    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials, ACCESS_TOKEN_TYPE)
        user_id = int(payload.get("sub", 0))
    except (ValueError, KeyError):
        raise exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise exc
    return user
