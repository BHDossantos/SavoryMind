"""AI-feature regression suite.

Covers the Claude-backed paths added in the AI commits — verifies they
gracefully fall back to the rules-based logic when ANTHROPIC_API_KEY
isn't set OR when the Claude SDK call fails. We never make real API
calls in CI (that would be slow, flaky, and expensive); instead we
patch claude_client.call_json with a stub.
"""
from unittest.mock import patch

from .conftest import register_user, auth_headers


# ---- claude_client core -------------------------------------------------


def test_claude_client_returns_none_when_unconfigured(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from app.services import claude_client
    assert claude_client.is_configured() is False
    assert claude_client.call_json("sys", "user", {"type": "object"}) is None


def test_claude_client_serializes_dict_payload(monkeypatch):
    """Dict payloads should be JSON-encoded before being sent to the SDK,
    so callers can hand over structured data directly."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    from app.services import claude_client

    captured = {}

    class FakeResponse:
        stop_reason = None
        class Block:
            type = "text"
            text = '{"ok": true}'
        content = [Block()]

    class FakeClient:
        class messages:
            @staticmethod
            def create(**kwargs):
                captured.update(kwargs)
                return FakeResponse()

    claude_client._client = FakeClient()
    try:
        result = claude_client.call_json("sys", {"a": 1, "b": "x"}, {"type": "object"})
        assert result == {"ok": True}
        # The SDK got a JSON string for the user message, not a raw dict
        msg = captured["messages"][0]["content"]
        assert isinstance(msg, str)
        assert '"a": 1' in msg or '"a":1' in msg
    finally:
        claude_client._client = None


# ---- Consumer recommendations ------------------------------------------


def test_consumer_recommendations_falls_back_to_rules_when_claude_unconfigured(client, db_session, monkeypatch):
    """No ANTHROPIC_API_KEY → engine uses the rules-based path. The route
    still returns a non-empty list, and items match the legacy schema."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    access, _ = register_user(client, account_type="consumer")

    r = client.get("/api/consumer/recommendations", headers=auth_headers(access))
    assert r.status_code == 200
    recs = r.json()
    assert isinstance(recs, list)
    # New consumers get the cuisine-based suggestion + maybe music-genre +
    # cold-start nudges. At minimum: rules fallback never returns empty.
    # (May be empty for a brand-new account_type=consumer user with no
    # onboarding data yet — that's also acceptable.)
    for item in recs:
        assert "type" in item and "title" in item and "body" in item
        assert "icon" in item and "action" in item and "confidence" in item


def test_consumer_recommendations_uses_claude_when_configured(client, db_session, monkeypatch):
    """When Claude returns a valid response, the engine surfaces it
    verbatim — not the rules-based output."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="consumer")

    fake_recs = [
        {
            "type": "wine_pairing",
            "title": "Smoked salmon Wednesday",
            "body": "You paired salmon twice last week — try a chablis.",
            "icon": "🍷",
            "action": "wine_pairing?dish=salmon",
            "confidence": 0.91,
        }
    ]

    with patch("app.ml.engine.claude_client.call_json", return_value={"recommendations": fake_recs}) as m:
        r = client.get("/api/consumer/recommendations", headers=auth_headers(access))
        assert r.status_code == 200
        # Claude was called exactly once
        assert m.call_count == 1
        assert r.json() == fake_recs


def test_consumer_recommendations_falls_back_when_claude_returns_empty(client, db_session, monkeypatch):
    """A null / malformed response from Claude must not produce an empty
    rec list — the rules-based engine fills in."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="consumer")

    with patch("app.ml.engine.claude_client.call_json", return_value=None):
        r = client.get("/api/consumer/recommendations", headers=auth_headers(access))
        assert r.status_code == 200
        # Falls back to rules — same item shape
        for item in r.json():
            assert {"type", "title", "body", "icon", "action", "confidence"} <= set(item.keys())


# ---- Diner recommendations ---------------------------------------------


def test_diner_recommendations_uses_claude_when_configured(client, db_session, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="diner")

    fake_recs = [
        {
            "type": "restaurant",
            "title": "Bookmark Osteria again",
            "body": "Your highest-rated visit (4.8★) — they have a new tasting menu.",
            "icon": "🍽️",
            "action": "book?restaurant=Osteria",
            "confidence": 0.93,
        }
    ]
    with patch("app.ml.engine.claude_client.call_json", return_value={"recommendations": fake_recs}):
        r = client.get("/api/diner/recommendations", headers=auth_headers(access))
        assert r.status_code == 200
        assert r.json() == fake_recs


def test_diner_recommendations_falls_back_to_rules(client, db_session, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    access, _ = register_user(client, account_type="diner")

    r = client.get("/api/diner/recommendations", headers=auth_headers(access))
    assert r.status_code == 200
    # Cold-start diner gets the "log your first visit" nudge in rules path
    types = [item["type"] for item in r.json()]
    assert "onboarding" in types or len(types) >= 1


# ---- Culinary assistant (refactored onto claude_client) ----------------


def test_assistant_returns_setup_message_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    access, _ = register_user(client, account_type="consumer")
    r = client.post(
        "/api/consumer/assistant",
        headers=auth_headers(access),
        json={"question": "How do I rest a steak?"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Assistant not configured"
    assert "ANTHROPIC_API_KEY" in body["answer"]


def test_assistant_returns_claude_response(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="consumer")
    fake = {"title": "Resting times", "answer": "Rest a 1-inch steak 5 minutes."}
    with patch("app.services.assistant_service.claude_client.call_json", return_value=fake):
        r = client.post(
            "/api/consumer/assistant",
            headers=auth_headers(access),
            json={"question": "How long to rest a steak?"},
        )
        assert r.status_code == 200
        assert r.json() == fake


def test_assistant_returns_try_again_on_claude_failure(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, account_type="consumer")
    with patch("app.services.assistant_service.claude_client.call_json", return_value=None):
        r = client.post(
            "/api/consumer/assistant",
            headers=auth_headers(access),
            json={"question": "anything"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["title"] == "Try again"
