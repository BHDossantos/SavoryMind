"""Expo push notifications.

Same shape as twilio_client / resend_client: a thin helper every feature
uses to send a native push. No-op + never raises when the user has no
Expo token; sanitized logging. Delivery is via Expo's push HTTP API
(https://exp.host/--/api/v2/push/send) so we need no SDK — just urllib.

Tokens are registered by the mobile app (POST /api/auth/push-token) and
stored on User.expo_push_token.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models.user import User

logger = logging.getLogger(__name__)

_EXPO_URL = "https://exp.host/--/api/v2/push/send"


def _looks_like_expo_token(token: str) -> bool:
    return bool(token) and (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["))


def send(token: Optional[str], title: str, body: str,
         data: Optional[dict[str, Any]] = None) -> bool:
    """Send a single push. Returns True on apparent success, False on any
    failure (missing/invalid token, network error). Never raises."""
    if not _looks_like_expo_token(token or ""):
        return False
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
    }
    if data:
        payload["data"] = data
    try:
        from urllib.request import Request, urlopen
        req = Request(
            _EXPO_URL,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=10) as resp:
            out = json.loads(resp.read().decode())
        # Expo returns {"data": {"status": "ok"|"error", ...}}
        status = (out.get("data") or {}).get("status")
        return status == "ok"
    except Exception as exc:
        logger.warning("push send failed: %s", type(exc).__name__)
        return False


def send_to_user(db: Session, user_id: int, title: str, body: str,
                 data: Optional[dict[str, Any]] = None) -> bool:
    """Look up the user's token and push. Best-effort."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.expo_push_token:
        return False
    return send(user.expo_push_token, title, body, data)
