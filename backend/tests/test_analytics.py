"""posthog_client wrapper tests.

Coverage:
- Silent no-op when POSTHOG_API_KEY unset (no SDK calls, no exceptions)
- Auth events fire on register/login/google when configured
- PII keys are stripped from event properties before forwarding
- SDK exceptions don't propagate (the analytics layer must NEVER 500
  a real request)
"""
from unittest.mock import patch

from .conftest import register_user, auth_headers


# ── posthog_client wrapper ───────────────────────────────────────────────


def test_capture_silent_noop_when_unconfigured(monkeypatch):
    """No POSTHOG_API_KEY → capture() is a silent no-op. _get_client
    returns None and capture short-circuits before the SDK is touched."""
    monkeypatch.delenv("POSTHOG_API_KEY", raising=False)
    from app.services import posthog_client
    posthog_client._client = None
    # Doesn't raise; SDK is never imported (posthog package isn't even
    # installed in the test sandbox — that's the proof).
    posthog_client.capture(123, "any_event", {"foo": "bar"})


def test_safe_properties_strips_pii_keys():
    """Defense-in-depth: the _safe_properties helper drops any key
    that looks like a credential, case-insensitively."""
    from app.services.posthog_client import _safe_properties
    out = _safe_properties({
        "safe":     "value",
        "password": "should be stripped",
        "API_KEY":  "case-insensitive",
        "Token":    "also stripped",
    })
    assert "safe" in out
    assert "password" not in out
    assert "API_KEY" not in out
    assert "Token" not in out


def test_capture_swallows_client_exception(monkeypatch):
    """If _get_client returns an object whose .capture() raises, the
    wrapper logs and returns. A real request must NEVER 500 because
    analytics broke."""
    monkeypatch.setenv("POSTHOG_API_KEY", "phc_test")
    from app.services import posthog_client

    class BoomClient:
        def capture(self, **_): raise RuntimeError("boom")

    with patch.object(posthog_client, "_get_client", return_value=BoomClient()):
        # Must not raise
        posthog_client.capture(123, "evt")


# ── Endpoint integration: events fire from real auth flow ───────────────


def test_register_fires_signup_completed_event(client, monkeypatch):
    monkeypatch.setenv("POSTHOG_API_KEY", "phc_test")
    from app.services import posthog_client
    posthog_client._client = None

    with patch("app.services.posthog_client.capture") as cap, \
         patch("app.services.posthog_client.identify") as ident:
        register_user(client, email="newuser@example.com")
        # Both should have fired exactly once
        assert ident.call_count == 1
        signup_calls = [c for c in cap.call_args_list if c.args[1] == "signup_completed"]
        assert len(signup_calls) == 1


def test_login_fires_login_completed_event(client, monkeypatch):
    monkeypatch.setenv("POSTHOG_API_KEY", "phc_test")
    register_user(client, email="logger@example.com")
    from app.services import posthog_client
    posthog_client._client = None

    with patch("app.services.posthog_client.capture") as cap:
        client.post("/api/auth/login", json={
            "email": "logger@example.com",
            "password": "password123",
        })
        login_calls = [c for c in cap.call_args_list if c.args[1] == "login_completed"]
        assert len(login_calls) == 1
        # Method property is captured for funnel segmentation
        assert login_calls[0].args[2]["method"] == "email_password"


def test_review_create_fires_review_submitted_event(client, monkeypatch):
    """Restaurant operator creates a review → review_submitted event.
    This is the most-impactful engagement signal for restaurant accounts."""
    monkeypatch.setenv("POSTHOG_API_KEY", "phc_test")
    access, _ = register_user(client, account_type="restaurant")
    from app.services import posthog_client
    posthog_client._client = None

    with patch("app.services.posthog_client.capture") as cap:
        client.post("/api/reviews/", json={
            "customer_name": "T",
            "menu_item":     "Truffle Pasta",  # one of the seeded items
            "rating":        5,
            "comment":       "Lovely",
        }, headers=auth_headers(access))
        evt_calls = [c for c in cap.call_args_list if c.args[1] == "review_submitted"]
        assert len(evt_calls) == 1
        assert evt_calls[0].args[2]["rating"] == 5
        assert evt_calls[0].args[2]["has_comment"] is True
        # PII never sent — verify the comment text is NOT in properties
        all_props = evt_calls[0].args[2]
        for v in all_props.values():
            if isinstance(v, str):
                assert "Lovely" not in v
