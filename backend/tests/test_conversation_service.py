"""Tests for Phase 14 — conversation persistence.

Covers conversation_service (get_or_create / save / list / get_thread
/ clear) at the unit level, plus the three new HTTP endpoints
(list / get / delete) and the conversation_id round-trip on the
/assistant POST.

The Anthropic SDK is mocked for the endpoint tests — a scripted fake
client returns a single end_turn response so the route exercises the
real persistence path without a live Claude call.
"""
import json

import pytest

from tests.conftest import register_user, auth_headers


# ── conversation_service unit tests ────────────────────────────────────────

def _svc():
    from app.services import conversation_service
    return conversation_service


def test_get_or_create_none_id_is_fresh(client, db_session):
    uid = register_user(client, email="c1@example.com")[1]["id"]
    convo, prior = _svc().get_or_create(db_session, uid, None)
    assert convo is None
    assert prior == []


def test_save_creates_row_and_title(client, db_session):
    uid = register_user(client, email="c2@example.com")[1]["id"]
    svc = _svc()
    messages = [{"role": "user", "content": "how do I sear steak?"}]
    cid = svc.save(db_session, uid, None, messages, "how do I sear steak?")
    assert cid is not None
    thread = svc.get_thread(db_session, uid, cid)
    assert thread["title"] == "how do I sear steak?"
    assert thread["messages"] == messages


def test_save_updates_existing(client, db_session):
    uid = register_user(client, email="c3@example.com")[1]["id"]
    svc = _svc()
    cid = svc.save(db_session, uid, None, [{"role": "user", "content": "q1"}], "q1")
    convo, prior = svc.get_or_create(db_session, uid, cid)
    assert prior == [{"role": "user", "content": "q1"}]
    # Second turn — same row, longer thread, title unchanged.
    svc.save(db_session, uid, convo, prior + [{"role": "assistant", "content": "a1"}], "q1")
    thread = svc.get_thread(db_session, uid, cid)
    assert len(thread["messages"]) == 2
    assert thread["title"] == "q1"


def test_get_or_create_stale_id_falls_through(client, db_session):
    uid = register_user(client, email="c4@example.com")[1]["id"]
    # A conversation_id that doesn't exist → fresh thread, no raise.
    convo, prior = _svc().get_or_create(db_session, uid, 999999)
    assert convo is None and prior == []


def test_conversation_is_user_scoped(client, db_session):
    svc = _svc()
    owner = register_user(client, email="owner-c@example.com")[1]["id"]
    other = register_user(client, email="other-c@example.com")[1]["id"]
    cid = svc.save(db_session, owner, None, [{"role": "user", "content": "private"}], "private")
    # A different user can't load, read, or clear it.
    convo, prior = svc.get_or_create(db_session, other, cid)
    assert convo is None and prior == []
    assert svc.get_thread(db_session, other, cid) is None
    assert svc.clear(db_session, other, cid) is False
    # ...but the owner still can.
    assert svc.get_thread(db_session, owner, cid) is not None


def test_save_trims_to_cap(client, db_session):
    uid = register_user(client, email="c5@example.com")[1]["id"]
    svc = _svc()
    cap = svc._MAX_STORED_MESSAGES
    big = [{"role": "user", "content": f"m{i}"} for i in range(cap + 25)]
    cid = svc.save(db_session, uid, None, big, "first")
    thread = svc.get_thread(db_session, uid, cid)
    assert len(thread["messages"]) == cap
    # Kept the most recent — last message survives, earliest is dropped.
    assert thread["messages"][-1]["content"] == f"m{cap + 24}"


def test_list_for_user_ordering(client, db_session):
    uid = register_user(client, email="c6@example.com")[1]["id"]
    svc = _svc()
    svc.save(db_session, uid, None, [{"role": "user", "content": "older"}], "older chat")
    svc.save(db_session, uid, None, [{"role": "user", "content": "newer"}], "newer chat")
    listed = svc.list_for_user(db_session, uid)
    assert len(listed) == 2
    # Most-recently-updated first.
    assert listed[0]["title"] == "newer chat"
    assert listed[0]["message_count"] == 1


def test_clear_removes_conversation(client, db_session):
    uid = register_user(client, email="c7@example.com")[1]["id"]
    svc = _svc()
    cid = svc.save(db_session, uid, None, [{"role": "user", "content": "x"}], "x")
    assert svc.clear(db_session, uid, cid) is True
    assert svc.get_thread(db_session, uid, cid) is None
    # Clearing again is a no-op False, not an error.
    assert svc.clear(db_session, uid, cid) is False


def test_safe_load_handles_garbage(client, db_session):
    """A corrupted messages column degrades to [] rather than raising."""
    from app.models.flavor import AssistantConversation
    uid = register_user(client, email="c8@example.com")[1]["id"]
    bad = AssistantConversation(user_id=uid, title="bad", messages="{not json")
    db_session.add(bad)
    db_session.commit()
    db_session.refresh(bad)
    convo, prior = _svc().get_or_create(db_session, uid, bad.id)
    assert prior == []  # garbage → empty, no crash


# ── Endpoint tests (Anthropic mocked) ──────────────────────────────────────

class _TextBlock:
    type = "text"
    def __init__(self, text): self.text = text


class _Resp:
    stop_reason = "end_turn"
    def __init__(self, text): self.content = [_TextBlock(text)]


def _fake_client(text="TITLE: Answer\n\nHere you go."):
    class _Messages:
        def create(self, **kw): return _Resp(text)
    class _Client:
        messages = _Messages()
    return _Client()


def test_assistant_post_returns_conversation_id(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, email="ep1@example.com")
    with patch("app.services.claude_client._get_client", return_value=_fake_client()):
        r = client.post(
            "/api/consumer/assistant",
            headers=auth_headers(access),
            json={"question": "what wine with steak?"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["conversation_id"] is not None
    assert body["title"] == "Answer"


def test_assistant_post_threads_on_conversation_id(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, email="ep2@example.com")
    with patch("app.services.claude_client._get_client", return_value=_fake_client()):
        r1 = client.post(
            "/api/consumer/assistant",
            headers=auth_headers(access),
            json={"question": "first question"},
        )
        cid = r1.json()["conversation_id"]
        r2 = client.post(
            "/api/consumer/assistant",
            headers=auth_headers(access),
            json={"question": "follow up", "conversation_id": cid},
        )
    assert r2.status_code == 200
    # Same conversation — the id is stable across the turn.
    assert r2.json()["conversation_id"] == cid


def test_list_conversations_endpoint(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, email="ep3@example.com")
    with patch("app.services.claude_client._get_client", return_value=_fake_client()):
        client.post("/api/consumer/assistant", headers=auth_headers(access),
                    json={"question": "a conversation starter"})
    r = client.get("/api/consumer/assistant/conversations", headers=auth_headers(access))
    assert r.status_code == 200
    convos = r.json()["conversations"]
    assert len(convos) == 1
    assert convos[0]["title"] == "a conversation starter"


def test_get_conversation_endpoint(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, email="ep4@example.com")
    with patch("app.services.claude_client._get_client", return_value=_fake_client()):
        post = client.post("/api/consumer/assistant", headers=auth_headers(access),
                           json={"question": "remember this"})
    cid = post.json()["conversation_id"]
    r = client.get(f"/api/consumer/assistant/conversations/{cid}", headers=auth_headers(access))
    assert r.status_code == 200
    assert r.json()["id"] == cid
    assert isinstance(r.json()["messages"], list)


def test_get_conversation_404_for_other_user(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    a, _ = register_user(client, email="ep5a@example.com")
    b, _ = register_user(client, email="ep5b@example.com")
    with patch("app.services.claude_client._get_client", return_value=_fake_client()):
        post = client.post("/api/consumer/assistant", headers=auth_headers(a),
                           json={"question": "user a's chat"})
    cid = post.json()["conversation_id"]
    # User B can't read user A's conversation.
    r = client.get(f"/api/consumer/assistant/conversations/{cid}", headers=auth_headers(b))
    assert r.status_code == 404


def test_delete_conversation_endpoint(client, monkeypatch):
    from unittest.mock import patch
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_key")
    access, _ = register_user(client, email="ep6@example.com")
    with patch("app.services.claude_client._get_client", return_value=_fake_client()):
        post = client.post("/api/consumer/assistant", headers=auth_headers(access),
                           json={"question": "delete me"})
    cid = post.json()["conversation_id"]
    r = client.delete(f"/api/consumer/assistant/conversations/{cid}", headers=auth_headers(access))
    assert r.status_code == 204
    # Gone now — second delete 404s.
    r2 = client.delete(f"/api/consumer/assistant/conversations/{cid}", headers=auth_headers(access))
    assert r2.status_code == 404
