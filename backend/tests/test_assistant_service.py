"""Tests for assistant_service + claude_client's tool-calling loop.

The Anthropic SDK is mocked — these tests verify our orchestration
(multi-turn loop, tool dispatch, response parsing, memory injection,
graceful fallbacks), NOT Claude itself. A fake client simulates the
two response shapes the loop has to handle: a `tool_use` turn and an
`end_turn` turn.
"""
import types

import pytest

from tests.conftest import register_user


# ── Fake Anthropic SDK objects ─────────────────────────────────────────────

class _TextBlock:
    type = "text"
    def __init__(self, text):
        self.text = text


class _ToolUseBlock:
    type = "tool_use"
    def __init__(self, id, name, input):
        self.id = id
        self.name = name
        self.input = input


class _Response:
    def __init__(self, stop_reason, content):
        self.stop_reason = stop_reason
        self.content = content


class _FakeMessages:
    """Replays a scripted list of responses, one per .create() call."""
    def __init__(self, scripted):
        self._scripted = list(scripted)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if not self._scripted:
            raise AssertionError("fake client ran out of scripted responses")
        return self._scripted.pop(0)


class _FakeClient:
    def __init__(self, scripted):
        self.messages = _FakeMessages(scripted)


@pytest.fixture
def patch_claude(monkeypatch):
    """Returns a function: install_scripted_client(responses) → fake client.
    Also forces is_configured() True so the tool loop runs."""
    from app.services import claude_client

    def install(scripted):
        fake = _FakeClient(scripted)
        monkeypatch.setattr(claude_client, "_get_client", lambda: fake)
        monkeypatch.setattr(claude_client, "is_configured", lambda: True)
        return fake

    return install


# ── _format_memories (pure) ────────────────────────────────────────────────

def test_format_memories_empty_is_blank():
    from app.services.assistant_service import _format_memories
    assert _format_memories([]) == ""


def test_format_memories_groups_by_category():
    from app.services.assistant_service import _format_memories
    block = _format_memories([
        {"fact": "Allergic to shellfish", "category": "dietary"},
        {"fact": "Oven runs hot", "category": "equipment"},
        {"fact": "Hates cilantro", "category": "preference"},
    ])
    assert "WHAT YOU REMEMBER" in block
    assert "[dietary]" in block and "Allergic to shellfish" in block
    assert "[equipment]" in block and "Oven runs hot" in block
    # dietary is rendered before preference (fixed category order).
    assert block.index("[dietary]") < block.index("[preference]")


# ── _parse_response (pure) ─────────────────────────────────────────────────

def test_parse_response_extracts_title_prefix():
    from app.services.assistant_service import _parse_response
    out = _parse_response("TITLE: Resting a steak\n\nLet it rest 5-10 minutes off the heat.")
    assert out["title"] == "Resting a steak"
    assert "rest 5-10 minutes" in out["answer"]


def test_parse_response_no_prefix_falls_back():
    from app.services.assistant_service import _parse_response
    out = _parse_response("Just sear it hot and fast.")
    assert out["title"] == "Flavor says"
    assert out["answer"] == "Just sear it hot and fast."


def test_parse_response_empty():
    from app.services.assistant_service import _parse_response
    out = _parse_response("")
    assert out["title"] and out["answer"]  # graceful, non-empty


# ── answer() fallbacks ─────────────────────────────────────────────────────

def test_answer_not_configured(monkeypatch):
    from app.services import assistant_service, claude_client
    monkeypatch.setattr(claude_client, "is_configured", lambda: False)
    out = assistant_service.answer("what wine with steak?")
    assert "not configured" in out["title"].lower()
    assert out["tool_calls"] == []


def test_answer_no_user_id_uses_legacy_path(monkeypatch):
    """Without user_id/db, answer() falls back to the no-tools
    call_json path — so the chat still works for smoke tests."""
    from app.services import assistant_service, claude_client
    monkeypatch.setattr(claude_client, "is_configured", lambda: True)
    monkeypatch.setattr(
        claude_client, "call_json",
        lambda *a, **k: {"title": "Quick answer", "answer": "Sear it hot."},
    )
    out = assistant_service.answer("how do I sear steak?")
    assert out["title"] == "Quick answer"
    assert out["tool_calls"] == []


# ── call_with_tools — the multi-turn loop ──────────────────────────────────

def test_call_with_tools_single_turn_no_tools(patch_claude):
    """Claude answers immediately with no tool calls."""
    from app.services import claude_client
    patch_claude([
        _Response("end_turn", [_TextBlock("TITLE: Hi\n\nHello there.")]),
    ])
    result = claude_client.call_with_tools(
        system_prompt="sys",
        messages=[{"role": "user", "content": "hi"}],
        tools=[],
        dispatcher=lambda name, args: {},
    )
    assert result["answer"] == "TITLE: Hi\n\nHello there."
    assert result["tool_calls"] == []


def test_call_with_tools_executes_one_tool(patch_claude):
    """Claude requests a tool, we run it, Claude finishes with text."""
    from app.services import claude_client

    patch_claude([
        # Turn 1: Claude asks for a tool.
        _Response("tool_use", [
            _ToolUseBlock("tu_1", "search_wines", {"query": "malbec"}),
        ]),
        # Turn 2: Claude answers after seeing the tool result.
        _Response("end_turn", [_TextBlock("TITLE: Malbec\n\nA Malbec works great.")]),
    ])

    dispatched = []
    def dispatcher(name, args):
        dispatched.append((name, args))
        return {"count": 1, "wines": [{"name": "Malbec"}]}

    result = claude_client.call_with_tools(
        system_prompt="sys",
        messages=[{"role": "user", "content": "wine for steak?"}],
        tools=[{"name": "search_wines"}],
        dispatcher=dispatcher,
    )

    assert dispatched == [("search_wines", {"query": "malbec"})]
    assert result["answer"] == "TITLE: Malbec\n\nA Malbec works great."
    assert len(result["tool_calls"]) == 1
    assert result["tool_calls"][0]["name"] == "search_wines"
    assert result["tool_calls"][0]["result"]["count"] == 1


def test_call_with_tools_dispatcher_exception_reported(patch_claude):
    """A tool that raises is caught — Claude sees an error result and
    can recover. The loop must not crash."""
    from app.services import claude_client

    patch_claude([
        _Response("tool_use", [_ToolUseBlock("tu_1", "boom", {})]),
        _Response("end_turn", [_TextBlock("TITLE: Recovered\n\nHandled it.")]),
    ])

    def dispatcher(name, args):
        raise RuntimeError("kaboom")

    result = claude_client.call_with_tools(
        system_prompt="sys",
        messages=[{"role": "user", "content": "x"}],
        tools=[{"name": "boom"}],
        dispatcher=dispatcher,
    )
    # The loop survived; the tool call is logged with the error result.
    assert result["answer"] == "TITLE: Recovered\n\nHandled it."
    assert len(result["tool_calls"]) == 1
    assert "error" in result["tool_calls"][0]["result"]


def test_call_with_tools_refusal(patch_claude):
    from app.services import claude_client
    patch_claude([_Response("refusal", [])])
    result = claude_client.call_with_tools(
        system_prompt="sys",
        messages=[{"role": "user", "content": "x"}],
        tools=[],
        dispatcher=lambda n, a: {},
    )
    assert result["answer"] is None


def test_call_with_tools_iteration_cap(patch_claude):
    """If Claude never stops calling tools, the loop bails at the cap
    instead of looping forever."""
    from app.services import claude_client
    # Script more tool_use turns than _MAX_TOOL_ITERATIONS.
    scripted = [
        _Response("tool_use", [_ToolUseBlock(f"tu_{i}", "noop", {})])
        for i in range(claude_client._MAX_TOOL_ITERATIONS + 2)
    ]
    patch_claude(scripted)
    result = claude_client.call_with_tools(
        system_prompt="sys",
        messages=[{"role": "user", "content": "x"}],
        tools=[{"name": "noop"}],
        dispatcher=lambda n, a: {"ok": True},
    )
    # Bailed without a final answer; didn't raise.
    assert result["answer"] is None
    assert len(result["tool_calls"]) == claude_client._MAX_TOOL_ITERATIONS


def test_call_with_tools_not_configured():
    from app.services import claude_client
    # Don't patch is_configured — depends on env. Force it false.
    import os
    old = os.environ.pop("ANTHROPIC_API_KEY", None)
    try:
        result = claude_client.call_with_tools(
            system_prompt="sys", messages=[], tools=[], dispatcher=lambda n, a: {},
        )
        assert result["answer"] is None
        assert result["tool_calls"] == []
    finally:
        if old is not None:
            os.environ["ANTHROPIC_API_KEY"] = old


# ── answer() end-to-end with tools + memory injection ──────────────────────

def test_answer_injects_memory_into_system_prompt(client, db_session, patch_claude):
    """A remembered fact must show up in the system prompt Claude sees."""
    from app.services import assistant_service, flavor_tools

    _, user = register_user(client, email="memflow@example.com")
    uid = user["id"]

    # Remember a fact directly.
    ctx = flavor_tools.UserContext(user_id=uid, account_type="consumer", language="en", db=db_session)
    flavor_tools.tool_remember_fact(ctx, fact="Allergic to peanuts", category="dietary")

    fake = patch_claude([
        _Response("end_turn", [_TextBlock("TITLE: Noted\n\nGot it.")]),
    ])

    out = assistant_service.answer(
        "what should I cook?",
        language="en", user_id=uid, account_type="consumer", db=db_session,
    )
    assert out["title"] == "Noted"
    # The system prompt passed to Claude must carry the remembered fact.
    system_arg = fake.messages.calls[0]["system"]
    system_text = system_arg if isinstance(system_arg, str) else system_arg[0]["text"]
    assert "Allergic to peanuts" in system_text


def test_answer_returns_tool_calls_for_ui(client, db_session, patch_claude):
    """answer() surfaces tool_calls so the frontend can render ghost lines."""
    from app.services import assistant_service

    _, user = register_user(client, email="toolui@example.com")
    uid = user["id"]

    patch_claude([
        _Response("tool_use", [_ToolUseBlock("tu_1", "search_wines", {"query": ""})]),
        _Response("end_turn", [_TextBlock("TITLE: Wines\n\nHere are some.")]),
    ])

    out = assistant_service.answer(
        "show me wines",
        language="en", user_id=uid, account_type="consumer", db=db_session,
    )
    assert out["title"] == "Wines"
    assert any(tc["name"] == "search_wines" for tc in out["tool_calls"])
