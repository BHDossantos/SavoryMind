"""Product analytics — PostHog wrapper.

Same shape as the other "external service" clients in this folder
(claude_client, resend_client). Single source of truth for capture +
identify calls so a future migration to a different analytics provider
or a kill-switch is one file.

Why PostHog: free tier covers 1M events/month, has a self-host fallback
if we ever want to leave their cloud, captures + funnels + cohorts in
one tool. Open source.

Configuration:
  POSTHOG_API_KEY  — project API key from posthog.com → Project Settings.
                     Empty string disables capture entirely (events
                     silently dropped, same pattern as Sentry-no-DSN).
  POSTHOG_HOST     — defaults to https://app.posthog.com (US cloud).
                     Set to https://eu.posthog.com if EU project, or to
                     a self-hosted URL.

Privacy contract (must stay in sync with frontend/src/pages/legal/privacy.js):
  - Events are linked to a user_id. We never capture anonymous traffic.
  - Event properties NEVER include passwords, tokens, OAuth refresh
    values, raw email content, or anything else PII-sensitive beyond
    the user_id and the event name + a small set of safe properties.
  - Identify() captures only the user's account_type and signup date —
    not their full profile.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)


_DEFAULT_HOST = "https://app.posthog.com"
_client = None


def is_configured() -> bool:
    return bool(os.getenv("POSTHOG_API_KEY"))


def _get_client():
    """Lazy import + lazy init. PostHog SDK is heavy; we don't want it
    paying its import cost on every cold start when analytics is unset."""
    global _client
    if not is_configured():
        return None
    if _client is not None:
        return _client
    try:
        from posthog import Posthog  # type: ignore
    except ImportError:
        logger.warning("posthog SDK not installed — analytics disabled")
        return None
    try:
        _client = Posthog(
            project_api_key=os.getenv("POSTHOG_API_KEY"),
            host=os.getenv("POSTHOG_HOST", _DEFAULT_HOST),
            # Reduce log noise. Real failures still log via our wrapper.
            disable_geoip=False,
        )
        return _client
    except Exception as exc:
        logger.warning("posthog init failed: %s", type(exc).__name__)
        return None


def capture(user_id: int | str, event: str, properties: Optional[dict[str, Any]] = None) -> None:
    """Capture a server-side event keyed on user_id.

    Never raises. Silent no-op when POSTHOG_API_KEY is unset. On send
    failure, logs the exception type only — never str(exc) — to keep
    any future PostHog SDK error-string changes from leaking sensitive
    request context.

    PRIVACY: properties must NOT include passwords, tokens, raw emails,
    OAuth refresh values, or any free-text user content. Stick to safe
    classifiers (account_type, recommendation_count, has_spotify_connected).
    """
    client = _get_client()
    if client is None:
        return
    try:
        client.capture(
            distinct_id=str(user_id),
            event=event,
            properties=_safe_properties(properties),
        )
    except Exception as exc:
        logger.warning("posthog capture failed: %s", type(exc).__name__)


def identify(user_id: int | str, traits: Optional[dict[str, Any]] = None) -> None:
    """Set persistent traits on a user — account_type, signup_date, etc.
    Never PII. Called once at signup + on profile changes that affect
    cohort segmentation."""
    client = _get_client()
    if client is None:
        return
    try:
        client.identify(
            distinct_id=str(user_id),
            properties=_safe_properties(traits),
        )
    except Exception as exc:
        logger.warning("posthog identify failed: %s", type(exc).__name__)


# Property keys we always strip before sending to PostHog as a defense-in-
# depth measure even though the call sites SHOULD never pass these.
_PII_KEYS = frozenset({
    "password", "password_hash", "token", "access_token", "refresh_token",
    "id_token", "secret", "api_key", "authorization",
})


def _safe_properties(properties: Optional[dict[str, Any]]) -> dict[str, Any]:
    """Strip any keys that look like credentials before forwarding."""
    if not properties:
        return {}
    return {k: v for k, v in properties.items() if k.lower() not in _PII_KEYS}


def shutdown() -> None:
    """Flush pending events. Called from FastAPI lifespan on shutdown so
    we don't drop the last batch when the container terminates."""
    if _client is not None:
        try:
            _client.shutdown()
        except Exception:
            pass
