import hmac
import hashlib
import base64
import json
import os
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db

bearer_scheme = HTTPBearer()

_ITERATIONS = 260_000


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


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.access_token_expire_days)
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(json.dumps({
        "sub": str(user_id),
        "email": email,
        "exp": int(expire.timestamp()),
    }).encode())
    signing_input = f"{header}.{payload}".encode()
    sig = hmac.new(settings.secret_key.encode(), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url_encode(sig)}"


def _decode_token(token: str) -> dict:
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
        payload = _decode_token(credentials.credentials)
        user_id = int(payload.get("sub", 0))
    except (ValueError, KeyError):
        raise exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise exc
    return user
