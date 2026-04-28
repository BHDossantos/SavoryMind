"""Server-side PostHog event capture.

Fire-and-forget HTTP POST to the PostHog capture endpoint. No-op when
NOCTURNA_POSTHOG_KEY is unset, so tests + dev are unaffected.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

log = logging.getLogger("nocturna.analytics")

POSTHOG_KEY = os.getenv("NOCTURNA_POSTHOG_KEY")
POSTHOG_HOST = os.getenv("NOCTURNA_POSTHOG_HOST", "https://eu.i.posthog.com").rstrip("/")


def is_enabled() -> bool:
    return bool(POSTHOG_KEY)


def capture(event: str, *, distinct_id: Optional[str] = None, properties: Optional[dict[str, Any]] = None):
    """Send a single event. Silent on errors so analytics never breaks the request path."""
    if not POSTHOG_KEY:
        return
    payload = {
        "api_key": POSTHOG_KEY,
        "event": event,
        "distinct_id": distinct_id or "anonymous_server",
        "properties": {**(properties or {}), "$lib": "nocturna-server"},
    }
    try:
        httpx.post(f"{POSTHOG_HOST}/capture/", json=payload, timeout=3.0)
    except Exception as e:  # noqa: BLE001
        log.debug("posthog capture failed: %s", e)
